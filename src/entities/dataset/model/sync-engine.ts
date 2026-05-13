'use client';
import { nanoid } from 'nanoid';
import { parseExcelFile } from '@/app/actions/parse';
import { fetchPgTableData, getPgSchema } from '@/app/actions/postgres';
import { useDatasetStore } from './store';
import { useColumnConfigStore } from '@/entities/columnConfig';
import { useDashboardStore } from '@/entities/dashboard';
import type { ColumnConfig, ColumnClassification, DatasetRow } from '@/types';
import type { PgConnectionConfig } from '@/lib/logic/postgres-client';
import { transliterate } from '@/shared/lib/utils/translit';

function classifyBySample(values: unknown[]): ColumnClassification {
  const valid = values.filter(v => v != null && v !== '');
  if (valid.length === 0) return 'ignore';
  const nums = valid.filter(v => typeof v === 'number');
  return nums.length / valid.length > 0.7 ? 'numeric' : 'categorical';
}

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
  const datasetId = `file-${nanoid()}`;
  
  try {
    const buffer = await file.arrayBuffer();
    const { data: sheets } = await parseExcelFile(buffer, file.name);
    if (sheets.length === 0 || sheets[0].rows.length === 0) throw new Error('Файл пуст');

    const flatRows: DatasetRow[] = sheets.flatMap(s => s.rows) as DatasetRow[];
    const headers = sheets[0].headers;

    const configs: ColumnConfig[] = headers.map((col, idx) => {
      const sample = flatRows.slice(0, 100).map(r => (r as Record<string, unknown>)[col]);
      return {
        columnName: col, displayName: col, alias: transliterate(col) || `col_${idx}`,
        classification: classifyBySample(sample), description: `Из файла ${file.name}`
      };
    });

    setConfigs.setDatasetConfigs(datasetId, configs);
    addDataset(datasetId, {
      name: file.name, sourceType: 'file',
      metadata: {
        sourceName: file.name, uploadedAt: Date.now(),
        sheetOrTableNames: sheets.map(s => s.sheetName),
        totalRows: flatRows.length, totalColumns: headers.length, sourceType: 'file'
      }
    });
    setDatasetRows(datasetId, flatRows);
    switchDataset(datasetId);
    return { success: true, datasetId };
  } catch (error) {
    console.error('[DatasetSync] File sync failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Ошибка загрузки' };
  } finally {
    setSyncing(false);
  }
}

export async function syncFromPostgres(config: PgConnectionConfig, schema: string, table: string) {
  const { setSyncing, addDataset, setDatasetRows, switchDataset } = useDatasetStore.getState();
  const setConfigs = useColumnConfigStore.getState();
  
  setSyncing(true);
  const datasetId = `pg-${nanoid()}`;
  
  try {
    const schemaRes = await getPgSchema(config);
    if (!schemaRes.success || !schemaRes.tables) throw new Error(schemaRes.error || 'Ошибка схемы');
    
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
    addDataset(datasetId, {
      name: `${schema}.${table}`, sourceType: 'postgres',
      metadata: {
        sourceName: `${schema}.${table}`, uploadedAt: Date.now(),
        sheetOrTableNames: [`${schema}.${table}`],
        totalRows: pgRows.length, totalColumns: dataRes.columns.length, sourceType: 'postgres'
      },
      pgConfig: { schema, table, lastSyncAt: Date.now() }
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