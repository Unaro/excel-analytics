'use client';
import { parseExcelFile } from '@/app/actions/parse';
import { fetchPgTableData, getPgSchema } from '@/app/actions/postgres';
import { useDatasetStore } from './store';
import { useColumnConfigStore } from '@/entities/excelData';
import { useDashboardStore } from '@/entities/dashboard';
import type { ColumnConfig, ColumnClassification, DatasetRow } from '@/types';
import type { PgConnectionConfig } from '@/lib/logic/postgres-client';
import { transliterate } from '@/shared/lib/utils/translit';

// --- Утилиты классификации ---

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

// --- Синхронизация ---

export async function syncFromFile(file: File) {
  const { setSyncing, setData } = useDatasetStore.getState();
  const { setConfigs } = useColumnConfigStore.getState();
  
  setSyncing(true);
  try {
    const buffer = await file.arrayBuffer();
    const { data: sheets } = await parseExcelFile(buffer, file.name);
    
    if (sheets.length === 0 || sheets[0].rows.length === 0) {
      throw new Error('Файл пуст или не содержит данных');
    }

    // ✅ Явное приведение к DatasetRow[] решает проблему вывода типов
    const flatRows: DatasetRow[] = sheets.flatMap(s => s.rows) as DatasetRow[];
    const headers = sheets[0].headers;

    // Авто-классификация колонок
    const configs: ColumnConfig[] = headers.map((col, idx) => {
      // ✅ Безопасный доступ через Record<string, unknown> убирает ошибку индексации
      const sample = flatRows.slice(0, 100).map(r => (r as Record<string, unknown>)[col]);
      const classification = classifyBySample(sample);
      return {
        columnName: col,
        displayName: col,
        alias: transliterate(col) || `col_${idx}`,
        classification,
        description: `Авто-определено из файла ${file.name}`
      };
    });

    setConfigs(configs);
    setData(flatRows, {
      sourceName: file.name,
      uploadedAt: Date.now(),
      sheetOrTableNames: sheets.map(s => s.sheetName),
      totalRows: flatRows.length,
      totalColumns: headers.length,
      sourceType: 'file'
    });
    return { success: true };
  } catch (error) {
    console.error('[DatasetSync] File sync failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Ошибка загрузки файла' };
  } finally {
    setSyncing(false);
  }
}
export async function syncFromPostgres(
  config: PgConnectionConfig,
  schema: string,
  table: string
) {
  const { setSyncing, setData } = useDatasetStore.getState();
  const { setConfigs } = useColumnConfigStore.getState();
  
  setSyncing(true);
  try {
    // 1. Читаем схему для типов
    const schemaRes = await getPgSchema(config);
    if (!schemaRes.success || !schemaRes.tables) {
        throw new Error(schemaRes.error || 'Ошибка чтения схемы БД');
    }
    
    const tableMeta = schemaRes.tables.find(t => t.schema === schema && t.table === table);
    if (!tableMeta) throw new Error('Таблица не найдена в схеме');

        // 2. Загружаем данные
    const dataRes = await fetchPgTableData(config, schema, table, 50000);
    if (!dataRes.success) throw new Error(dataRes.error);

    const pgRows: DatasetRow[] = dataRes.rows as DatasetRow[];

    // 3. Классификация на основе PG-типов
    const configs: ColumnConfig[] = tableMeta.columns.map((col, idx) => ({
      columnName: col.name,
      displayName: col.name,
      alias: transliterate(col.name) || `col_${idx}`,
      classification: mapPgType(col.type),
      description: `PG тип: ${col.type}`
    }));

    setConfigs(configs);
    setData(pgRows, {
      sourceName: `${schema}.${table}`,
      uploadedAt: Date.now(),
      sheetOrTableNames: [`${schema}.${table}`],
      totalRows: pgRows.length,
      totalColumns: dataRes.columns.length,
      sourceType: 'postgres'
    }, { schema, table, lastSyncAt: Date.now() });

    return { success: true };
  } catch (error) {
    console.error('[DatasetSync] PG sync failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Ошибка подключения к БД' };
  } finally {
    setSyncing(false);
  }
}

/**
 * Безопасный сброс фильтров при смене источника данных
 * Вызывается автоматически при изменении структуры колонок
 */
export function reconcileDashboardFilters(dashboardId: string) {
  const headers = useDatasetStore.getState().getHeaders();
  const dashboard = useDashboardStore.getState().getDashboard(dashboardId);
  if (!dashboard || headers.length === 0) return;

  const validColumns = new Set(headers);
  const invalidFilters = dashboard.hierarchyFilters.filter(f => !validColumns.has(f.columnName));

  if (invalidFilters.length > 0) {
    useDashboardStore.getState().clearHierarchyFilters(dashboardId);
    console.log('[DatasetSync] Filters cleared due to source change');
  }
}