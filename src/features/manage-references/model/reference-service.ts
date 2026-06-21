// features/manage-references/model/reference-service.ts
// ─────────────────────────────────────────────────────────────
// Оркестрация справочников: импорт файла как служебного датасета
// (role: 'reference'), построение словаря «код → имя», каскадное
// удаление. Дизайн: docs/architecture/reference-types.md
// ─────────────────────────────────────────────────────────────

import { logger } from '@/shared/lib/logger';
import { nanoid } from 'nanoid';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import { useDatasetStore } from '@/entities/dataset';
import {
  useReferenceTypeStore,
  normalizeKey,
  saveDictionary,
  deleteDictionary,
  type ReferenceType,
} from '@/entities/reference-type';
import { duckdbManager } from '@/shared/lib/computation/lib/duckdb/manager';
import type { ColumnConfig } from '@/shared/lib/types';

export interface ImportDictionaryResult {
  success: boolean;
  datasetId?: string;
  /** Конфиги колонок — для выбора ключа/отображения в UI настройки. */
  configs?: ColumnConfig[];
  error?: string;
}

/**
 * Импортирует файл справочника тем же конвейером, что и датасеты,
 * но с ролью 'reference': без переключения активного датасета и без
 * глобального isSyncing (импорт справочника не должен останавливать
 * вычисления открытых дашбордов).
 */
export async function importDictionaryFile(file: File): Promise<ImportDictionaryResult> {
  const { addDataset } = useDatasetStore.getState();
  const datasetId = `ref_${nanoid()}`;

  try {
    const buffer = await file.arrayBuffer();
    const { configs, totalRows, totalColumns, sheetNames } =
      await duckdbManager.importExcelBuffer(datasetId, file.name, buffer);

    // Arrow-персистентность: словарь можно будет пересобрать после
    // перезагрузки страницы (таблица восстановится из буфера)
    try {
      const arrowBuffer = await duckdbManager.exportArrowBuffer(datasetId);
      await idbSet(`arrow:${datasetId}`, arrowBuffer);
    } catch (exportErr) {
      logger.warn('[reference-service] Arrow export failed:', exportErr);
    }

    addDataset(datasetId, {
      name: file.name,
      role: 'reference',
      sourceType: 'file',
      engineStatus: 'ready',
      metadata: {
        sourceName: file.name,
        uploadedAt: Date.now(),
        sheetOrTableNames: sheetNames,
        totalRows,
        totalColumns,
        sourceType: 'file',
      },
    });

    return { success: true, datasetId, configs };
  } catch (error) {
    logger.error('[reference-service] Dictionary import failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки справочника',
    };
  }
}

/**
 * Гарантирует, что таблица справочника есть в воркере
 * (после перезагрузки страницы восстанавливает её из Arrow-буфера).
 */
async function ensureDictionaryTable(datasetId: string): Promise<boolean> {
  if (await duckdbManager.checkTable(datasetId)) return true;
  const arrowBuffer = await idbGet(`arrow:${datasetId}`);
  if (!(arrowBuffer instanceof Uint8Array) || arrowBuffer.byteLength === 0) {
    return false;
  }
  return duckdbManager.ensureReady(datasetId, arrowBuffer);
}

/**
 * Строит (или пересобирает) словарь типа из таблицы справочника
 * и сохраняет его в IndexedDB. Возвращает число записей.
 *
 * @throws Error если таблица недоступна и не восстановилась из Arrow
 */
export async function buildDictionary(type: ReferenceType): Promise<number> {
  const ready = await ensureDictionaryTable(type.dictionaryDatasetId);
  if (!ready) {
    throw new Error(
      'Таблица справочника недоступна — загрузите файл справочника заново'
    );
  }

  const rawPairs = await duckdbManager.getColumnPairs(
    type.dictionaryDatasetId,
    type.keyColumn,
    type.displayColumn
  );

  // Нормализация ключей при ПОСТРОЕНИИ — симметрична нормализации
  // при поиске (normalizeKey в use-column-dictionary)
  const normalized: Array<[string, string]> = rawPairs.map(([k, v]) => [
    normalizeKey(k, type.keyNormalization),
    v,
  ]);

  await saveDictionary(type.id, normalized);
  useReferenceTypeStore.getState().updateType(type.id, { entryCount: normalized.length });
  return normalized.length;
}

/**
 * Удаляет пользовательский тип вместе со словарём.
 * Привязки колонок (customTypeId) не трогаем: подстановка просто
 * перестаёт работать (resolve вернёт код), это безопасно.
 */
export async function removeReferenceType(typeId: string): Promise<void> {
  await deleteDictionary(typeId);
  useReferenceTypeStore.getState().removeType(typeId);
}

/**
 * Полностью удаляет справочник: все зависимые типы, их словари,
 * DuckDB-таблицу, Arrow-буфер и запись датасета.
 */
export async function removeDictionaryDataset(datasetId: string): Promise<void> {
  const dependentTypes = useReferenceTypeStore
    .getState()
    .getTypesByDictionary(datasetId);
  for (const t of dependentTypes) {
    await removeReferenceType(t.id);
  }

  try {
    await duckdbManager.dropTable(datasetId);
  } catch (err) {
    logger.warn('[reference-service] Drop table failed (non-critical):', err);
  }
  try {
    await idbDel(`arrow:${datasetId}`);
  } catch (err) {
    logger.warn('[reference-service] Delete arrow buffer failed:', err);
  }
  useDatasetStore.getState().removeDataset(datasetId);
}
