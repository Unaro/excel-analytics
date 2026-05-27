'use client';
import { nanoid } from 'nanoid';
import { fetchPgTableData, getPgSchema, testPgConnection } from '@/app/actions/postgres';
import { useDatasetStore } from './store';
import { useColumnConfigStore } from '@/entities/columnConfig';
import { useDashboardStore } from '@/entities/dashboard';
import { transliterate } from '@/shared/lib/utils/translit';
import { toast } from 'sonner';
import { decryptConfig, encryptConfig } from '@/shared/lib/utils/crypto';
import { duckdbManager } from '@/features/computation/lib/duckdb/manager';
import { PgConnectionConfig } from '@/shared/api/postgres/client';
import { ColumnClassification, ColumnConfig, DatasetRow, ReplaceFileResult } from './types';
import { del, set } from 'idb-keyval';
import { createComputationCache } from '@/lib/storage';

function mapPgType(type: string): ColumnClassification {
  const t = type.toLowerCase();
  if (['int2','int4','int8','float4','float8','numeric','decimal'].some(k => t.includes(k))) return 'numeric';
  if (['bool','boolean'].some(k => t.includes(k))) return 'categorical';
  if (['date','timestamp','time'].some(k => t.includes(k))) return 'date';
  return 'categorical';
}

/**
 * Импорт Excel/CSV файла как нового датасета.
 *
 * Flow:
 * 1. Воркер парсит файл и импортирует ВСЕ данные в DuckDB (таблица dt_<id>)
 * 2. Запрашиваем PREVIEW (500 строк) для UI
 * 3. Экспортируем Arrow buffer для персистентности в IndexedDB
 * 4. Сохраняем метаданные и configs
 */
export async function syncFromFile(file: File) {
  const { setSyncing, addDataset, setDatasetRows, switchDataset } = useDatasetStore.getState();
  const setConfigs = useColumnConfigStore.getState();
  setSyncing(true);
  const datasetId = `file_${nanoid()}`;

  try {
    const buffer = await file.arrayBuffer();
    
    // 1. Импортируем ВЕСЬ файл в DuckDB
    const { configs, totalRows, totalColumns, sheetNames } = await duckdbManager.importExcelBuffer(
      datasetId,
      file.name,
      buffer
    );

    let arrowBuffer: Uint8Array | null = null;
    try {
      arrowBuffer = await duckdbManager.exportArrowBuffer(datasetId);
      await set(`arrow:${datasetId}`, arrowBuffer);
      console.log(`[syncFromFile] ✅ Arrow buffer saved to IndexedDB: ${(arrowBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);
    } catch (exportErr) {
      console.warn('[syncFromFile] Arrow export failed, data will not persist across reloads:', exportErr);
      toast.warning(
        'Данные загружены, но не удалось сохранить в кэш. ' +
        'После перезагрузки страницы файл нужно будет загрузить заново.'
      );
    }

    // 3. Запрашиваем PREVIEW для UI
    let previewRows: DatasetRow[] = [];
    try {
      previewRows = await duckdbManager.getPreviewRows(datasetId, 500);
      console.log(`[syncFromFile] ✅ Preview fetched: ${previewRows.length} rows (из ${totalRows} всего)`);
    } catch (previewErr) {
      console.warn('[syncFromFile] Preview fetch failed:', previewErr);
    }

    // 4. Сохраняем метаданные
    setConfigs.setDatasetConfigs(datasetId, configs);
    
    addDataset(datasetId, {
      name: file.name,
      sourceType: 'file',
      engineStatus: 'ready',
      metadata: {
        sourceName: file.name,
        uploadedAt: Date.now(),
        sheetOrTableNames: sheetNames,
        totalRows,
        totalColumns,
        sourceType: 'file'
      }
    });

    // 5. Сохраняем PREVIEW в store
    setDatasetRows(datasetId, previewRows);
    switchDataset(datasetId);

    return { success: true, datasetId };
  } catch (error) {
    console.error('[DatasetSync] File sync failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Ошибка загрузки' };
  } finally {
    setSyncing(false);
  }
}

// ==========================================================
// PostgreSQL логика оставлена БЕЗ ИЗМЕНЕНИЙ (работает через старую схему)
// ==========================================================

export async function syncFromPostgres(config: PgConnectionConfig, schema: string, table: string) {
  const { setSyncing, addDataset, setDatasetRows, switchDataset } = useDatasetStore.getState();
  const setConfigs = useColumnConfigStore.getState();
  setSyncing(true);
  const datasetId = `pg-${nanoid()}`;
  try {
    const schemaRes = await getPgSchema(config);
    if (!schemaRes.success || !schemaRes.tables) throw new Error('Ошибка схемы');
    const tableMeta = schemaRes.tables.find(t => t.schema === schema && t.table === table);
    if (!tableMeta) throw new Error('Таблица не найдена');
    const dataRes = await fetchPgTableData(config, schema, table, 50000);
    if (!dataRes.success) throw new Error(dataRes.error);
    const pgRows: DatasetRow[] = dataRes.rows as DatasetRow[];
    const configs: ColumnConfig[] = tableMeta.columns.map((col, idx) => ({
      columnName: col.name, displayName: col.name, alias: transliterate(col.name) || `col_${idx}`,
      classification: mapPgType(col.type), description: `PG тип: ${col.type}`
    }));
    setConfigs.setDatasetConfigs(datasetId, configs);
    const encrypted = await encryptConfig(config);
    addDataset(datasetId, {
      name: `${schema}.${table}`, sourceType: 'postgres',
      metadata: {
        sourceName: `${schema}.${table}`, uploadedAt: Date.now(),
        sheetOrTableNames: [`${schema}.${table}`],
        totalRows: pgRows.length, totalColumns: dataRes.columns.length, sourceType: 'postgres'
      },
      pgConfig: { schema, table, lastSyncAt: Date.now(), encryptedConnection: encrypted }
    });
    setDatasetRows(datasetId, pgRows);
    switchDataset(datasetId);
    return { success: true, datasetId };
  } catch (error) {
    console.error('[DatasetSync] PG sync failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Ошибка подключения' };
  } finally {
    setSyncing(false);
  }
}

export function reconcileDashboardFilters(dashboardId: string) {
  const headers = useDatasetStore.getState().getHeaders();
  const dashboard = useDashboardStore.getState().getDashboard(dashboardId);
  if (!dashboard || headers.length === 0) return;
  const valid = new Set(headers);
  const invalid = dashboard.hierarchyFilters.filter(f => !valid.has(f.columnName));
  if (invalid.length > 0) {
    useDashboardStore.getState().clearHierarchyFilters(dashboardId);
  }
}

export async function refreshPgDataset(datasetId: string) {
  const store = useDatasetStore.getState();
  const entry = store.datasets[datasetId];
  if (!entry || entry.sourceType !== 'postgres' || !entry.pgConfig) {
    toast.error('Некорректная конфигурация датасета');
    return { success: false };
  }
  if (!entry.pgConfig.encryptedConnection) {
    toast.error('Конфигурация подключения отсутствует. Переподключите датасет через настройки.');
    return { success: false };
  }
  const { schema, table } = entry.pgConfig;
  store.setPgStatus(datasetId, 'checking');
  try {
    const config = await decryptConfig<PgConnectionConfig>(entry.pgConfig.encryptedConnection);

    const realTest = await testPgConnection(config);
    if (!realTest.success) throw new Error(realTest.error || 'Отказано в доступе');

    const dataRes = await fetchPgTableData(config, schema, table, 50000);
    if (!dataRes.success) throw new Error(dataRes.error);

    store.setDatasetRows(datasetId, dataRes.rows as DatasetRow[]);
    store.setPgStatus(datasetId, 'online');
    toast.success(`Данные "${entry.name}" обновлены (${dataRes.totalFetched} строк)`);
    return { success: true };
  } catch (error) {
    console.error('[PG Refresh Failed]', error);
    store.setPgStatus(datasetId, 'offline');
    toast.warning(`Не удалось обновить "${entry.name}". Используются кэшированные данные.`);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown' };
  }
}

/**
 * Заменяет файл существующего датасета под тем же datasetId.
 *
 * КЛЮЧЕВЫЕ ПРИНЦИПЫ:
 *  1. ID датасета НЕ меняется — все связи с дашбордами/группами сохраняются
 *  2. Существующие колонки сохраняют classification/alias/displayName
 *  3. Удалённые колонки НЕ удаляются из configs, а помечаются как 'ignore'
 *     (чтобы метрики дашбордов не падали, а показывали "колонка не найдена")
 *  4. Кэш вычислений автоматически инвалидируется через timestamp
 *
 * @param datasetId ID существующего file-датасета
 * @param newFile Новый файл (должен быть Excel/CSV)
 */
export async function replaceDatasetFile(
  datasetId: string,
  newFile: File
): Promise<ReplaceFileResult> {
  const store = useDatasetStore.getState();
  const configsStore = useColumnConfigStore.getState();
  const entry = store.datasets[datasetId];

  // ─────────────────────────────────────────────────────────────
  // Валидация
  // ─────────────────────────────────────────────────────────────
  if (!entry) {
    return { success: false, error: 'Датасет не найден' };
  }
  if (entry.sourceType !== 'file') {
    return { success: false, error: 'Замена файла доступна только для file-источников' };
  }

  store.setSyncing(true);
  store.updateDataset(datasetId, { engineStatus: 'loading' });

  try {
    // ─────────────────────────────────────────────────────────────
    // 1. Получаем старые configs (для согласования)
    // ─────────────────────────────────────────────────────────────
    const oldConfigs = configsStore.getConfigs(datasetId);
    const oldConfigMap = new Map(oldConfigs.map(c => [c.columnName, c]));
    const oldColumnNames = new Set(oldConfigs.map(c => c.columnName));

    // ─────────────────────────────────────────────────────────────
    // 2. Полная очистка старого состояния
    // ─────────────────────────────────────────────────────────────
    // 2.1. Удаляем таблицу из DuckDB
    try {
      await duckdbManager.dropTable(datasetId);
    } catch (err) {
      console.warn('[replaceDatasetFile] Drop table failed (non-critical):', err);
    }

    // 2.2. Удаляем Arrow buffer из IndexedDB
    try {
      await del(`arrow:${datasetId}`);
    } catch (err) {
      console.warn('[replaceDatasetFile] Delete arrow buffer failed:', err);
    }

    // 2.3. Инвалидируем кэш вычислений для этого датасета
    //      (чтобы дашборды пересчитались на новых данных)
    try {
      const cache = createComputationCache('file');
      await cache.clear(datasetId);
    } catch (err) {
      console.warn('[replaceDatasetFile] Cache invalidation failed:', err);
    }

    // ─────────────────────────────────────────────────────────────
    // 3. Импорт нового файла
    // ─────────────────────────────────────────────────────────────
    const buffer = await newFile.arrayBuffer();
    const { configs: newAutoConfigs, totalRows, totalColumns, sheetNames } =
      await duckdbManager.importExcelBuffer(datasetId, newFile.name, buffer);

    // ─────────────────────────────────────────────────────────────
    // 4. Экспорт Arrow buffer для персистентности
    // ─────────────────────────────────────────────────────────────
    try {
      const arrowBuffer = await duckdbManager.exportArrowBuffer(datasetId);
      await set(`arrow:${datasetId}`, arrowBuffer);
      console.log(
        `[replaceDatasetFile] ✅ Arrow buffer saved: ` +
        `${(arrowBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`
      );
    } catch (err) {
      console.warn('[replaceDatasetFile] Arrow export failed:', err);
    }

    // ─────────────────────────────────────────────────────────────
    // 5. Согласование configs
    //    - Сохраняем пользовательские настройки для существующих колонок
    //    - Помечаем удалённые колонки как 'ignore' (не удаляем)
    // ─────────────────────────────────────────────────────────────
    const newColumnNames = new Set(newAutoConfigs.map(c => c.columnName));

    const addedColumns = newAutoConfigs
      .map(c => c.columnName)
      .filter(name => !oldColumnNames.has(name));

    const removedColumns = Array.from(oldColumnNames).filter(
      name => !newColumnNames.has(name)
    );

    // Формируем финальные configs
    const mergedConfigs: ColumnConfig[] = newAutoConfigs.map(newCfg => {
      const oldCfg = oldConfigMap.get(newCfg.columnName);
      if (oldCfg) {
        // Колонка существовала — сохраняем пользовательские настройки
        return {
          ...newCfg,
          classification: oldCfg.classification,
          alias: oldCfg.alias,
          displayName: oldCfg.displayName,
          description: oldCfg.description || newCfg.description,
        };
      }
      // Новая колонка — auto-классификация
      return newCfg;
    });

    // Добавляем удалённые колонки с пометкой 'ignore'
    // Это предотвращает падение дашбордов, использующих эти колонки
    for (const removedName of removedColumns) {
      const oldCfg = oldConfigMap.get(removedName)!;
      mergedConfigs.push({
        ...oldCfg,
        classification: 'ignore',
        description: `[КОЛОНКА УДАЛЕНА ИЗ ФАЙЛА] ${oldCfg.description || ''}`.trim(),
      });
    }

    configsStore.setDatasetConfigs(datasetId, mergedConfigs);

    // ─────────────────────────────────────────────────────────────
    // 6. Получаем PREVIEW и сохраняем в store
    // ─────────────────────────────────────────────────────────────
    let previewRows: DatasetRow[] = [];
    try {
      previewRows = await duckdbManager.getPreviewRows(datasetId, 500);
    } catch (err) {
      console.warn('[replaceDatasetFile] Preview fetch failed:', err);
    }

    // ─────────────────────────────────────────────────────────────
    // 7. Обновляем metadata и rows в store
    // ─────────────────────────────────────────────────────────────
    store.updateDataset(datasetId, {
      name: newFile.name,
      engineStatus: 'ready',
      metadata: {
        ...entry.metadata,
        sourceName: newFile.name,
        uploadedAt: Date.now(),
        sheetOrTableNames: sheetNames,
        totalRows,
        totalColumns,
      }
    });
    store.setDatasetRows(datasetId, previewRows);

    return {
      success: true,
      addedColumns,
      removedColumns,
    };
  } catch (error) {
    console.error('[DatasetSync] Replace file failed:', error);
    store.updateDataset(datasetId, { engineStatus: 'error' });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка замены файла'
    };
  } finally {
    store.setSyncing(false);
  }
}