// entities/dataset/model/sync-engine.ts
// ─────────────────────────────────────────────────────────────
// Оркестрация синхронизации датасетов.
//
// Отвечает за:
//   - Импорт Excel/CSV файлов в DuckDB
//   - Импорт данных из PostgreSQL
//   - Обновление PG-датасетов
//   - Замену файла существующего датасета
//
// НЕ отвечает за:
//   - Чистую бизнес-логику (мерж конфигов, валидация фильтров) —
//     она делегирована в shared/lib/services/
//   - UI-оркестрацию (toast, router) — это задачи features/
//   - Кросс-entity связи (dashboard filters) — feature-level
// ─────────────────────────────────────────────────────────────

'use client';

import { logger } from '@/shared/lib/logger';
import { nanoid } from 'nanoid';
import { useDatasetStore } from '@/entities/dataset';
import { useColumnConfigStore } from '@/entities/column-config';
import { toast } from '@/shared/ui/toast';
import { decryptConfig, encryptConfig } from '@/shared/lib/utils/crypto';
import { duckdbManager } from '@/shared/lib/computation/lib/duckdb/manager';
import { createComputationCache } from '@/shared/lib/storage';
import {
  fetchPgTableData,
  getPgSchema,
  testPgConnection,
} from '@/shared/api/server-actions';
import type { PgConnectionConfig } from '@/shared/api/postgres/client';
import type { ReplaceFileResult } from '@/entities/dataset';
import { del, set } from 'idb-keyval';

// ─────────────────────────────────────────────────────────────
// Чистые функции из shared/services
// ─────────────────────────────────────────────────────────────
import { mergeColumnConfigs } from '@/shared/lib/services';
import { generateColumnConfigsFromPgSchema } from '@/entities/dataset';
import { useHierarchyStore } from '@/entities/hierarchy';
import { useMetricTemplateStore } from '@/entities/metric';
import { useIndicatorGroupStore } from '@/entities/indicator-group';
import { useAggregateNodesStore } from '@/entities/aggregate-nodes';
import { DatasetRow } from '@/shared/lib/types';
import type { ColumnClassification } from '@/shared/lib/types';
import type { AggregateNode } from '@/shared/lib/types/aggregate';
import type { ImportParams } from '../lib/file-preview';
import { readAggregateMatrix } from '../lib/file-preview';
import {
  flattenLeaves,
  toAggregateCsv,
  extractNodes,
  type AggregateLayoutConfig,
  type AggregateColumn,
} from '../lib/aggregate-layout';

/**
 * Создаёт группы показателей из колонок-метрик агрегата: по одной группе на
 * верхний заголовок шапки (proposeGroups). Для КАЖДОЙ колонки заводится свой
 * шаблон `SUM(колонка)` с именем колонки — иначе на дашборде все метрики
 * схлопываются в одну (общий шаблон = одна идентичность: нельзя добавить
 * вторую колонку и переименовать). Снятые в панели группы пропускаются.
 */
function createAggregateGroups(
  datasetId: string,
  columns: AggregateColumn[],
  excludeGroups?: string[]
): number {
  const byGroup = new Map<string, AggregateColumn[]>();
  for (const col of columns) {
    if (col.role !== 'metric') continue;
    const key = col.groupName || '(без группы)';
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key)!.push(col);
  }
  if (byGroup.size === 0) return 0;

  const exclude = new Set(excludeGroups ?? []);
  const templateStore = useMetricTemplateStore.getState();
  const groupStore = useIndicatorGroupStore.getState();

  let created = 0;
  for (const [groupName, cols] of byGroup) {
    if (exclude.has(groupName)) continue;
    const metrics = cols.map((col, i) => {
      // Свой шаблон на колонку: имя = составное имя колонки (уникально и понятно
      // в списке шаблонов/на дашборде), формула SUM(value), value → колонка.
      const templateId = templateStore.addTemplate({
        name: col.fullName,
        formula: 'SUM(value)',
        dependencies: [{ type: 'field', alias: 'value' }],
        displayFormat: 'number',
        decimalPlaces: 2,
      });
      return {
        id: nanoid(),
        templateId,
        fieldBindings: [{ id: nanoid(), fieldAlias: 'value', columnName: col.fullName }],
        metricBindings: [],
        enabled: true,
        order: i,
        customName: col.name || col.fullName,
      };
    });
    groupStore.addGroup({ name: groupName, fieldMappings: [], metrics, order: created }, datasetId);
    created++;
  }
  return created;
}

// ─────────────────────────────────────────────────────────────
// syncFromFile
// ─────────────────────────────────────────────────────────────

/**
 * Импорт Excel/CSV файла как нового датасета.
 *
 * Flow:
 *   1. Worker парсит файл и импортирует ВСЕ данные в DuckDB (таблица dt_<id>)
 *   2. Экспортируем Arrow buffer для персистентности в IndexedDB
 *   3. Запрашиваем PREVIEW (500 строк) для UI
 *   4. Сохраняем метаданные и configs
 */
export async function syncFromFile(
  file: File,
  params?: ImportParams,
  aggregate?: AggregateLayoutConfig
) {
  const { setSyncing, addDataset, setDatasetRows, switchDataset } =
    useDatasetStore.getState();
  const setConfigs = useColumnConfigStore.getState();

  setSyncing(true);
  const datasetId = `file_${nanoid()}`;

  try {
    const buffer = await file.arrayBuffer();

    // ✅ Прогресс-коллбек — можно подключить к UI-индикатору
    const onProgress = (progress: {
      phase: string;
      current: number;
      total: number;
      percent: number;
    }) => {
      logger.debug(
        `[syncFromFile] Progress: ${progress.percent}% ` +
          `(${progress.current.toLocaleString()}/${progress.total.toLocaleString()})`
      );
      // TODO: опционально обновлять Zustand-стор для UI-индикатора
    };

    // 1. Импортируем весь файл в DuckDB.
    // Параметры разбора (шаг «Импорт») → быстрый нативный путь для CSV.
    // Агрегат: читаем весь файл, сплющиваем в листья → плоский CSV (нативный
    // путь), ключи → categorical (VARCHAR, коды), метрики → numeric, уровни
    // иерархии создаём по ключевым колонкам. Предпосчитанные узлы — фаза 2.
    let importBuffer: ArrayBuffer = buffer;
    let importFileName = file.name;
    let aggregateKeyNames: string[] | null = null;
    let aggregateColumns: AggregateColumn[] | null = null;
    let aggregateNodes: AggregateNode[] | null = null;
    let effectiveTypes: Record<string, ColumnClassification> | undefined = params?.columnTypes;
    let parseOptions = params
      ? {
          delimiter: params.delimiter ?? ',',
          decimalSeparator: params.decimalSeparator,
          columnTypes: params.columnTypes,
          dateFormat: params.dateFormat,
        }
      : undefined;

    if (aggregate) {
      const { matrix } = readAggregateMatrix(buffer, file.name, { all: true });
      const flat = flattenLeaves(matrix, aggregate);
      const csv = toAggregateCsv(flat);
      importBuffer = new TextEncoder().encode(csv).buffer as ArrayBuffer;
      importFileName = `${file.name.replace(/\.[^.]+$/, '')}.csv`;
      const columnTypes: Record<string, ColumnClassification> = {};
      for (const col of flat.columns) {
        columnTypes[col.fullName] = col.role === 'metric' ? 'numeric' : 'categorical';
      }
      effectiveTypes = columnTypes;
      parseOptions = { delimiter: ',', decimalSeparator: '.', columnTypes, dateFormat: undefined };
      aggregateKeyNames = flat.keyColumnNames;
      aggregateColumns = flat.columns;
      aggregateNodes = extractNodes(matrix, aggregate);
      logger.info(`[syncFromFile] Агрегат сплющен: ${flat.rows.length} листьев, ${flat.keyColumnNames.length} уровней, ${aggregateNodes.length} узлов`);
    }

    const { configs, totalRows, totalColumns, sheetNames } =
      await duckdbManager.importExcelBuffer(
        datasetId,
        importFileName,
        importBuffer,
        onProgress,
        parseOptions
      );

    // Применяем выбранные пользователем типы колонок (классификация —
    // единый источник на стороне UI; влияет на метрики/ось/иерархию).
    const finalConfigs = effectiveTypes
      ? configs.map((c) => ({
          ...c,
          classification: effectiveTypes[c.columnName] ?? c.classification,
        }))
      : configs;

    let arrowBuffer: Uint8Array | null = null;
    try {
      arrowBuffer = await duckdbManager.exportArrowBuffer(datasetId);
      await set(`arrow:${datasetId}`, arrowBuffer);
      logger.debug(
        `[syncFromFile] ✅ Arrow buffer saved: ` +
          `${(arrowBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`
      );
    } catch (exportErr) {
      logger.warn('[syncFromFile] Arrow export failed:', exportErr);
      toast.warning(
        'Данные загружены, но не удалось сохранить в кэш. ' +
          'После перезагрузки страницы файл нужно будет загрузить заново.'
      );
    }

    // 3. Запрашиваем PREVIEW для UI
    let previewRows: DatasetRow[] = [];
    try {
      previewRows = await duckdbManager.getPreviewRows(datasetId, 500);
      logger.debug(
        `[syncFromFile] ✅ Preview fetched: ${previewRows.length} rows`
      );
    } catch (previewErr) {
      logger.warn('[syncFromFile] Preview fetch failed:', previewErr);
    }

    setConfigs.setDatasetConfigs(datasetId, finalConfigs);

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
        sourceType: 'file',
      },
    });

    // Агрегат: ключевые колонки → уровни иерархии (каскад город→зона→объект).
    if (aggregateKeyNames?.length) {
      const hierarchy = useHierarchyStore.getState();
      for (const name of aggregateKeyNames) {
        hierarchy.addLevel(datasetId, { columnName: name, displayName: name });
      }
    }

    // Агрегат: метрики шапки → группы показателей (SUM по колонке).
    if (aggregateColumns) {
      const n = createAggregateGroups(datasetId, aggregateColumns, aggregate?.excludeGroups);
      logger.info(`[syncFromFile] Создано групп показателей: ${n}`);
    }

    // Агрегат: введённые значения узлов (overlay «введённое vs вычисленное»).
    if (aggregateNodes) {
      useAggregateNodesStore.getState().setNodes(datasetId, aggregateNodes);
    }

    setDatasetRows(datasetId, previewRows);
    switchDataset(datasetId);

    return { success: true, datasetId };
  } catch (error) {
    logger.error('[DatasetSync] File sync failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка загрузки',
    };
  } finally {
    setSyncing(false);
  }
}

// ─────────────────────────────────────────────────────────────
// syncFromPostgres
// ─────────────────────────────────────────────────────────────

/**
 * Импорт данных из PostgreSQL как нового датасета.
 * Использует `generateColumnConfigsFromPgSchema` из type-mapper
 * для построения конфигов (единый источник правды для PG-маппинга).
 */
export async function syncFromPostgres(
  config: PgConnectionConfig,
  schema: string,
  table: string
) {
  const { setSyncing, addDataset, setDatasetRows, switchDataset } =
    useDatasetStore.getState();
  const setConfigs = useColumnConfigStore.getState();

  setSyncing(true);
  const datasetId = `pg-${nanoid()}`;

  try {
    // 1. Получаем схему таблицы
    const schemaRes = await getPgSchema(config);
    if (!schemaRes.success || !schemaRes.tables) {
      throw new Error('Ошибка схемы');
    }

    const tableMeta = schemaRes.tables.find(
      (t) => t.schema === schema && t.table === table
    );
    if (!tableMeta) throw new Error('Таблица не найдена');

    // 2. Загружаем данные (до 50k строк)
    const dataRes = await fetchPgTableData(config, schema, table, 50000);
    if (!dataRes.success) throw new Error(dataRes.error);

    // 3. ✅ Строим configs из схемы PG через единый маппер
    const configs = generateColumnConfigsFromPgSchema(
      tableMeta.columns,
      `${schema}.${table}`
    );

    setConfigs.setDatasetConfigs(datasetId, configs);

    // 4. Шифруем конфиг подключения для персистентности
    const encrypted = await encryptConfig(config);

    addDataset(datasetId, {
      name: `${schema}.${table}`,
      sourceType: 'postgres',
      metadata: {
        sourceName: `${schema}.${table}`,
        uploadedAt: Date.now(),
        sheetOrTableNames: [`${schema}.${table}`],
        totalRows: dataRes.rows.length,
        totalColumns: dataRes.columns.length,
        sourceType: 'postgres',
      },
      pgConfig: {
        schema,
        table,
        lastSyncAt: Date.now(),
        encryptedConnection: encrypted,
      },
    });

    setDatasetRows(datasetId, dataRes.rows as DatasetRow[]);
    switchDataset(datasetId);

    return { success: true, datasetId };
  } catch (error) {
    logger.error('[DatasetSync] PG sync failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка подключения',
    };
  } finally {
    setSyncing(false);
  }
}

// ─────────────────────────────────────────────────────────────
// refreshPgDataset
// ─────────────────────────────────────────────────────────────

/**
 * Обновление данных PostgreSQL-датасета без изменения его ID.
 */
export async function refreshPgDataset(datasetId: string) {
  const store = useDatasetStore.getState();
  const entry = store.datasets[datasetId];

  if (!entry || entry.sourceType !== 'postgres' || !entry.pgConfig) {
    toast.error('Некорректная конфигурация датасета');
    return { success: false };
  }

  if (!entry.pgConfig.encryptedConnection) {
    toast.error(
      'Конфигурация подключения отсутствует. Переподключите датасет через настройки.'
    );
    return { success: false };
  }

  const { schema, table } = entry.pgConfig;
  store.setPgStatus(datasetId, 'checking');

  try {
    const config = await decryptConfig<PgConnectionConfig>(
      entry.pgConfig.encryptedConnection
    );

    // Быстрая проверка живости соединения
    const realTest = await testPgConnection(config);
    if (!realTest.success) throw new Error(realTest.error || 'Отказано в доступе');

    const dataRes = await fetchPgTableData(config, schema, table, 50000);
    if (!dataRes.success) throw new Error(dataRes.error);

    store.setDatasetRows(datasetId, dataRes.rows as DatasetRow[]);
    store.setPgStatus(datasetId, 'online');
    toast.success(`Данные "${entry.name}" обновлены (${dataRes.totalFetched} строк)`);
    return { success: true };
  } catch (error) {
    logger.error('[PG Refresh Failed]', error);
    store.setPgStatus(datasetId, 'offline');
    toast.warning(
      `Не удалось обновить "${entry.name}". Используются кэшированные данные.`
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown',
    };
  }
}

// ─────────────────────────────────────────────────────────────
// replaceDatasetFile
// ─────────────────────────────────────────────────────────────

/**
 * Заменяет файл существующего датасета под тем же datasetId.
 *
 * КЛЮЧЕВЫЕ ПРИНЦИПЫ:
 *   - ID датасета НЕ меняется — все связи с дашбордами/группами сохраняются
 *   - Существующие колонки сохраняют classification/alias/displayName
 *   - Удалённые колонки НЕ удаляются, а помечаются как 'ignore'
 *     (метрики дашбордов не падают, а показывают "колонка не найдена")
 *   - Кэш вычислений автоматически инвалидируется через clear()
 *
 * Чистая бизнес-логика мержа конфигов делегирована в shared/lib/services.
 */
export async function replaceDatasetFile(
  datasetId: string,
  newFile: File
): Promise<ReplaceFileResult> {
  const store = useDatasetStore.getState();
  const configsStore = useColumnConfigStore.getState();
  const entry = store.datasets[datasetId];

  // ─── Валидация ────────────────────────────────────────────
  if (!entry) {
    return { success: false, error: 'Датасет не найден' };
  }
  if (entry.sourceType !== 'file') {
    return {
      success: false,
      error: 'Замена файла доступна только для file-источников',
    };
  }

  store.setSyncing(true);
  store.updateDataset(datasetId, { engineStatus: 'loading' });

  try {
    // 1. Получаем старые configs (для согласования)
    const oldConfigs = configsStore.getConfigs(datasetId);

    // 2. Полная очистка старого состояния
    try {
      await duckdbManager.dropTable(datasetId);
    } catch (err) {
      logger.warn('[replaceDatasetFile] Drop table failed (non-critical):', err);
    }

    try {
      await del(`arrow:${datasetId}`);
    } catch (err) {
      logger.warn('[replaceDatasetFile] Delete arrow buffer failed:', err);
    }

    try {
      const cache = createComputationCache('file');
      await cache.clear(datasetId);
    } catch (err) {
      logger.warn('[replaceDatasetFile] Cache invalidation failed:', err);
    }

    // 3. Импорт нового файла
    const buffer = await newFile.arrayBuffer();
    const {
      configs: newAutoConfigs,
      totalRows,
      totalColumns,
      sheetNames,
    } = await duckdbManager.importExcelBuffer(datasetId, newFile.name, buffer);

    // 4. Экспорт Arrow buffer для персистентности
    try {
      const arrowBuffer = await duckdbManager.exportArrowBuffer(datasetId);
      await set(`arrow:${datasetId}`, arrowBuffer);
      logger.debug(
        `[replaceDatasetFile] ✅ Arrow buffer saved: ` +
          `${(arrowBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`
      );
    } catch (err) {
      logger.warn('[replaceDatasetFile] Arrow export failed:', err);
    }

    // 5. ✅ ДЕЛЕГИРУЕМ МЕРЖ КОНФИГОВ В ЧИСТЫЙ СЕРВИС
    const { mergedConfigs, addedColumns, removedColumns } = mergeColumnConfigs(
      oldConfigs,
      newAutoConfigs
    );

    configsStore.setDatasetConfigs(datasetId, mergedConfigs);

    // 6. Получаем PREVIEW и сохраняем в store
    let previewRows: DatasetRow[] = [];
    try {
      previewRows = await duckdbManager.getPreviewRows(datasetId, 500);
    } catch (err) {
      logger.warn('[replaceDatasetFile] Preview fetch failed:', err);
    }

    // 7. Обновляем metadata и rows в store
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
      },
    });
    store.setDatasetRows(datasetId, previewRows);

    return {
      success: true,
      addedColumns,
      removedColumns,
    };
  } catch (error) {
    logger.error('[DatasetSync] Replace file failed:', error);
    store.updateDataset(datasetId, { engineStatus: 'error' });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка замены файла',
    };
  } finally {
    store.setSyncing(false);
  }
}