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
import { ColumnClassification, ColumnConfig, DatasetRow } from './types';
import { set } from 'idb-keyval';

function mapPgType(type: string): ColumnClassification {
  const t = type.toLowerCase();
  if (['int2','int4','int8','float4','float8','numeric','decimal'].some(k => t.includes(k))) return 'numeric';
  if (['bool','boolean'].some(k => t.includes(k))) return 'categorical';
  if (['date','timestamp','time'].some(k => t.includes(k))) return 'date';
  return 'categorical';
}

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