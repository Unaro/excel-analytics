import * as duckdb from '@duckdb/duckdb-wasm';
import { tableFromIPC, tableFromJSON } from 'apache-arrow';
import { compileQuery } from '../query-compiler';
import { postProcessAggregates, recalculateFormulasOnAggregated } from '../post-process';
import { getActiveFilter, formatValue } from '../utils';
import { transliterate } from '@/shared/lib/utils/translit';
import { aggregateProcessedRows } from '../aggregation';
import { ClientComputeParams, CompiledQuery, MetricAggregationMeta } from '../types';
import { parseExcelInWorker } from './excel-parser';
import { buildTableName } from './table-name';

// --- 1. ОПРЕДЕЛЯЕМ СТРОГИЕ ТИПЫ ДЛЯ СООБЩЕНИЙ ---

export interface RegisterArrowPayload {
  datasetId: string;
  buffer: Uint8Array;
}

export interface ComputePayload {
  params: ClientComputeParams;
}

export interface ImportExcelPayload {
  datasetId: string;
  fileName: string;
  buffer: ArrayBuffer;
}

export interface GetPreviewPayload {
  datasetId: string;
  limit: number;
}

export interface ExportArrowPayload {
  datasetId: string;
}

export interface DropTablePayload {
  datasetId: string;
}

export type WorkerMessage = 
  | { type: 'REGISTER_ARROW'; id: number; payload: RegisterArrowPayload }
  | { type: 'COMPUTE'; id: number; payload: ComputePayload }
  | { type: 'IMPORT_EXCEL'; id: number; payload: ImportExcelPayload }
  | { type: 'GET_PREVIEW'; id: number; payload: GetPreviewPayload }
  | { type: 'EXPORT_ARROW'; id: number; payload: ExportArrowPayload }
  | { type: 'DROP_TABLE'; id: number; payload: DropTablePayload };

// --- ОСТАЛЬНАЯ ЛОГИКА ---

function toAbsoluteUrl(path: string): string {
  return new URL(path, self.location.origin).href;
}

// Конфигурация бандлов DuckDB
const EH_BUNDLE = {
  mainModule: toAbsoluteUrl('/duckdb/duckdb-eh.wasm'),
  mainWorker: toAbsoluteUrl('/duckdb/duckdb-browser-eh.worker.js'),
};

const MVP_BUNDLE = {
  mainModule: toAbsoluteUrl('/duckdb/duckdb-mvp.wasm'),
  mainWorker: toAbsoluteUrl('/duckdb/duckdb-browser-mvp.worker.js'),
};

let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;

async function loadWorkerScript(workerUrl: string): Promise<Worker> {
  // Сначала пробуем создать worker напрямую
  try {
    return new Worker(workerUrl);
  } catch (directErr) {
    console.warn('[DuckDB] Direct worker load failed, using blob fallback:', directErr);
  }
  
  const response = await fetch(workerUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch worker script: ${response.status} ${response.statusText} from ${workerUrl}`);
  }
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  return new Worker(blobUrl);
}

let initPromise: Promise<void> | null = null;

async function initDB(): Promise<void> {
  // Если инициализация уже идёт или завершена — ждём тот же Promise
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const worker = await loadWorkerScript(EH_BUNDLE.mainWorker);
      const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
      db = new duckdb.AsyncDuckDB(logger, worker);
      await db.instantiate(EH_BUNDLE.mainModule);
      conn = await db.connect();
      console.log('[DuckDB] ✅ Initialized with EH bundle');
    } catch (ehError) {
      console.warn('[DuckDB] EH bundle failed, falling back to MVP:', ehError);
      try {
        const worker = await loadWorkerScript(MVP_BUNDLE.mainWorker);
        const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
        db = new duckdb.AsyncDuckDB(logger, worker);
        await db.instantiate(MVP_BUNDLE.mainModule);
        conn = await db.connect();
        console.log('[DuckDB] ✅ Initialized with MVP bundle (fallback)');
      } catch (mvpError) {
        initPromise = null; // Сбрасываем, чтобы можно было попробовать снова
        throw new Error(
          `DuckDB initialization failed: ${mvpError instanceof Error ? mvpError.message : 'Unknown'}`
        );
      }
    }
  })();

  return initPromise;
}


/**
 * Строит маппинг alias → тип агрегации из params.
 */
function buildAggregateMetadataMap(
  params: ClientComputeParams
): Map<string, MetricAggregationMeta> {
  const metadata = new Map<string, MetricAggregationMeta>();

  for (const cfg of params.dashboardGroupsConfig) {
    if (!cfg.enabled) continue;
    const groupDef = params.groups.find(g => g.id === cfg.groupId);
    if (!groupDef) continue;

    for (const metric of groupDef.metrics) {
      if (!metric.enabled) continue;
      const tpl = params.metricTemplates.find(t => t.id === metric.templateId);
      if (tpl?.type === 'aggregate' && tpl.aggregateFunction) {
        const alias = `${cfg.groupId}__${metric.id}`;
        metadata.set(alias, { aggregateFunction: tpl.aggregateFunction });
      }
    }
  }

  return metadata;
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { type, payload, id } = e.data;

  try {
    await initDB();

    if (!conn) {
      throw new Error('DuckDB connection was not established after initDB()');
    }

    if (type === 'REGISTER_ARROW') {
      const { datasetId, buffer } = payload;
      const tableName = buildTableName(datasetId);
      
      await conn!.query(`DROP TABLE IF EXISTS ${tableName}`);
      
      const arrowTable = tableFromIPC(buffer);
      await conn!.insertArrowTable(arrowTable, { name: tableName });
      
      self.postMessage({ id, success: true });
    }

    if (type === 'COMPUTE') {
      const { params } = payload;
      const { dashboardId, dashboardGroupsConfig, virtualMetrics, filters, groupByColumn } = params;

      const { sql, formulas, aggregateMetadata } = compileQuery(params, 'duckdb');
      const table = await conn!.query(sql);
      const rows = table.toArray() as Record<string, unknown>[];

      const firstRow = rows[0] || {};
      const totalRecords = typeof firstRow['_record_count'] === 'number'
        ? firstRow['_record_count']
        : typeof firstRow['_record_count'] === 'bigint'
          ? Number(firstRow['_record_count'])
          : rows.length;

      const processedRows = postProcessAggregates(rows, formulas);

      const groups = dashboardGroupsConfig
        .filter(cfg => cfg.enabled)
        .map(cfg => {
          const groupDef = params.groups.find(g => g.id === cfg.groupId);

          const breakdownItems = groupByColumn ? processedRows
            .map((processed, idx) => {
              const rawLabel = rows[idx]['_group_label'];
              const label = rawLabel === null || rawLabel === undefined
                ? ''
                : String(rawLabel).trim();
              const recordCount = typeof rows[idx]['_record_count'] === 'number'
                ? rows[idx]['_record_count']
                : Number(rows[idx]['_record_count'] ?? 0);

              const groupVirtualMetrics = virtualMetrics.map(vm => {
                const binding = cfg.virtualMetricBindings?.find(b => b.virtualMetricId === vm.id);
                if (!binding) return { virtualMetricId: vm.id, virtualMetricName: vm.name, value: null, formattedValue: '—', sourceMetricId: '' };

                const alias = `${cfg.groupId}__${binding.metricId}`;
                const numericValue = typeof processed[alias] === 'number' ? processed[alias] : null;

                return {
                  virtualMetricId: vm.id,
                  virtualMetricName: vm.name,
                  value: numericValue,
                  formattedValue: formatValue(numericValue, vm.displayFormat, vm.decimalPlaces, vm.unit),
                  sourceMetricId: binding.metricId
                };
              });

              return { label, recordCount, virtualMetrics: groupVirtualMetrics };
            })
            .filter(item => item.label !== '')
            : undefined;

          const summaryProcessed = groupByColumn
            ? aggregateProcessedRows(processedRows, aggregateMetadata, formulas)
            : processedRows[0] || {};

          const groupVirtualMetrics = virtualMetrics.map(vm => {
            const binding = cfg.virtualMetricBindings?.find(b => b.virtualMetricId === vm.id);
            if (!binding) return { virtualMetricId: vm.id, virtualMetricName: vm.name, value: null, formattedValue: '—', sourceMetricId: '' };

            const alias = `${cfg.groupId}__${binding.metricId}`;
            const numericValue = typeof summaryProcessed[alias] === 'number' ? summaryProcessed[alias] : null;

            return {
              virtualMetricId: vm.id,
              virtualMetricName: vm.name,
              value: numericValue,
              formattedValue: formatValue(numericValue, vm.displayFormat, vm.decimalPlaces, vm.unit),
              sourceMetricId: binding.metricId
            };
          });

          return {
            groupId: cfg.groupId,
            groupName: groupDef?.name ?? `Группа ${cfg.groupId}`,
            virtualMetrics: groupVirtualMetrics,
            breakdown: breakdownItems,
            recordCount: totalRecords,
            computedAt: Date.now()
          };
        });

      const result = {
        dashboardId,
        hierarchyFilters: filters,
        activeFilter: getActiveFilter(filters),
        virtualMetrics,
        groups,
        totalRecords,
        computedAt: Date.now()
      };

      self.postMessage({ id, success: true, result });
    }
    
    if (type === 'IMPORT_EXCEL') {
      const { datasetId, fileName, buffer } = payload;
      
      // 1. Парсинг происходит в фоновом потоке, UI остается отзывчивым!
      const sheets = parseExcelInWorker(buffer);
      if (sheets.length === 0 || sheets[0].rows.length === 0) {
        throw new Error('Файл пуст');
      }

      const flatRows = sheets
        .flatMap(s => s.rows)
        .filter(row => Object.values(row).some(v => v !== null && v !== ''));
      
      
      if (flatRows.length === 0) {
        throw new Error('После фильтрации пустых строк данных не осталось');
      }

      const headers = sheets[0].headers;
      const tableName = buildTableName(datasetId);
      
      await conn!.query(`DROP TABLE IF EXISTS ${tableName}`);

      // 2. Батчинг (Чанкование) для защиты оперативной памяти
      const BATCH_SIZE = 15000;
      await conn!.query(`DROP TABLE IF EXISTS ${tableName}`);

      for (let i = 0; i < flatRows.length; i += BATCH_SIZE) {
        const chunk = flatRows.slice(i, i + BATCH_SIZE);
        const arrowTable = tableFromJSON(chunk);
        const isFirstBatch = i === 0;

        await conn!.insertArrowTable(arrowTable, {
          name: tableName,
          create: isFirstBatch,   // создаём только на первом батче
        });
        chunk.length = 0;
      }

      // 3. Формируем метаданные для Zustand (чтобы не гонять это в UI-потоке)
      const sample = flatRows.slice(0, 100);
      const configs = headers.map((col, idx) => {
        const colSample = sample.map((r: any) => r[col]);
        const valid = colSample.filter(v => v != null && v !== '');
        const nums = valid.filter(v => typeof v === 'number');
        const classification = valid.length === 0 ? 'ignore' : 
          (nums.length / valid.length > 0.7 ? 'numeric' : 'categorical');
        
        return {
          columnName: col, 
          displayName: col, 
          alias: transliterate(col) || `col_${idx}`,
          classification, 
          description: `Из файла ${fileName}`
        };
      });

      self.postMessage({ 
        id, 
        success: true, 
        result: { 
          configs, 
          totalRows: flatRows.length,
          totalColumns: headers.length,
          sheetNames: sheets.map(s => s.sheetName)
        } 
      });
    }

    if (type === 'GET_PREVIEW') {
      const { datasetId, limit } = payload;
      const tableName = buildTableName(datasetId);
      
      try {
        // Проверяем что таблица существует
        const checkTable = await conn!.query(`
          SELECT COUNT(*) as cnt 
          FROM information_schema.tables 
          WHERE table_name = '${tableName}'
        `);
        const tableExists = (checkTable.toArray()[0])?.cnt > 0;
        
        if (!tableExists) {
          self.postMessage({ 
            id, 
            success: true, 
            result: []
          });
          return;
        }
        
        // Безопасный limit
        const safeLimit = Math.max(1, Math.min(limit, 5000));
        const table = await conn!.query(`SELECT * FROM ${tableName} LIMIT ${safeLimit}`);
        
        // Конвертация Arrow → JS objects
        const rows = table.toArray().map(row => {
          const obj: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(row)) {
            // Arrow возвращает специальные типы, нормализуем к простым
            if (value === null || value === undefined) {
              obj[key] = null;
            } else if (typeof value === 'bigint') {
              obj[key] = Number(value);
            } else if (value instanceof Date) {
              obj[key] = value.toISOString().split('T')[0];
            } else {
              obj[key] = value;
            }
          }
          return obj;
        });
        
        self.postMessage({ id, success: true, result: rows });
      } catch (err) {
        console.error('[Worker] GET_PREVIEW failed:', err);
        self.postMessage({ 
          id, 
          success: false, 
          error: err instanceof Error ? err.message : 'Preview fetch failed' 
        });
      }
    }

    if (type === 'EXPORT_ARROW') {
      const { datasetId } = payload;
      const tableName = buildTableName(datasetId);
      
      try {
        // Проверяем что таблица существует
        const checkTable = await conn!.query(`
          SELECT COUNT(*) as cnt 
          FROM information_schema.tables 
          WHERE table_name = '${tableName}'
        `);
        const tableExists = (checkTable.toArray()[0])?.cnt > 0;
        
        if (!tableExists) {
          throw new Error(`Table ${tableName} does not exist`);
        }
        
        // Экспортируем ВСЕ данные из таблицы в Arrow IPC format
        const table = await conn!.query(`SELECT * FROM ${tableName}`);
        
        // Конвертируем Arrow Table в IPC Stream (Uint8Array)
        const { tableToIPC } = await import('apache-arrow');
        const arrowBuffer = tableToIPC(table, 'stream');
        
        // Передаём buffer как Transferable для zero-copy
        self.postMessage({ id, success: true, result: arrowBuffer });
      } catch (err) {
        console.error('[Worker] EXPORT_ARROW failed:', err);
        self.postMessage({ 
          id, 
          success: false, 
          error: err instanceof Error ? err.message : 'Export failed' 
        });
      }
    }

    if (type === 'DROP_TABLE') {
      const { datasetId } = payload;
      const tableName = buildTableName(datasetId);
      try {
        await conn!.query(`DROP TABLE IF EXISTS ${tableName}`);
        console.log(`[Worker] Dropped table: ${tableName}`);
        self.postMessage({ id, success: true });
      } catch (err) {
        console.error('[Worker] DROP_TABLE failed:', err);
        self.postMessage({
          id,
          success: false,
          error: err instanceof Error ? err.message : 'Drop table failed'
        });
      }
    }

  } catch (error) {
    self.postMessage({ id, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
};