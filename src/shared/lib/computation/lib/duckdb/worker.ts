import * as duckdb from '@duckdb/duckdb-wasm';
import { tableFromIPC, tableFromJSON } from 'apache-arrow';
import { compileQuery } from '../query-compiler';
import { postProcessAggregates, recalculateFormulasOnAggregated } from '../post-process';
import { getActiveFilter, formatValue } from '../utils';
import { transliterate } from '@/shared/lib/utils/translit';
import { aggregateProcessedRows } from '../aggregation';
import { ClientComputeParams } from '../types';
import { convertExcelToCsvBuffer } from './excel-parser';
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

/**
 * Безопасное приведение значения из DuckDB к числу.
 * DuckDB часто возвращает BigInt для COUNT(*) или SUM(), что ломает JS-математику.
 */
function toNumber(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return isFinite(val) ? val : null;
  if (typeof val === 'bigint') return Number(val);
  if (typeof val === 'string') {
    const num = Number(val);
    return !isNaN(num) && isFinite(num) ? num : null;
  }
  return null;
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
        initPromise = null;
        throw new Error(
          `DuckDB initialization failed: ${mvpError instanceof Error ? mvpError.message : 'Unknown'}`
        );
      }
    }
  })();

  return initPromise;
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

            let summaryProcessed: Record<string, number | null>;

            if (groupByColumn) {
              // 1. Сначала агрегируем "сырые" числовые значения (SUM, AVG и т.д.) по всем строкам
              const aggregatedRow = aggregateProcessedRows(processedRows, aggregateMetadata, formulas);
              
              // 2. Затем заново пересчитываем CALCULATED метрики (формулы) на основе новых итоговых данных
              summaryProcessed = recalculateFormulasOnAggregated(aggregatedRow, formulas);
            } else {
              // Если группировки нет, SQL и так вернул нам одну агрегированную строку
              summaryProcessed = processedRows[0] || {};
            }

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
      const tableName = buildTableName(datasetId);
      
      // Конвертируем Excel в CSV
      const { csvBuffer, sheetNames } = convertExcelToCsvBuffer(buffer);
      const csvFileName = `${datasetId}_import.csv`;
      db!.registerFileBuffer(csvFileName, csvBuffer);
      
      await conn!.query(`DROP TABLE IF EXISTS ${tableName}`);
      
      await conn!.query(`
        CREATE TABLE ${tableName} AS 
        SELECT * FROM read_csv_auto(
          '${csvFileName}',
          sample_size = -1,              -- Сканировать весь файл для определения типов
          auto_detect = true,            -- Включить автоопределение
          ignore_errors = true,          -- Игнорировать проблемные строки
          null_padding = true,           -- Заполнять пропуски NULL
          all_varchar = false,           -- НЕ определять всё как строки
          delim = ',',
          quote = '"'
        )
      `);
      
      const schemaResult = await conn!.query(`DESCRIBE ${tableName}`);
      const schemaRows = schemaResult.toArray() as Array<{
        column_name: string;
        column_type: string;
        null: string;
        key: string;
        default: string;
        extra: string;
      }>;
      
      const configs = schemaRows.map((row, idx) => {
        const duckType = row.column_type.toUpperCase();
        let classification: 'numeric' | 'date' | 'categorical' = 'categorical';
        
        if (duckType.includes('INT') || 
            duckType.includes('DECIMAL') || 
            duckType.includes('FLOAT') || 
            duckType.includes('DOUBLE') || 
            duckType.includes('NUMERIC') ||
            duckType.includes('HUGEINT')) {
          classification = 'numeric';
        } 
        else if (duckType.includes('DATE') || 
                duckType.includes('TIMESTAMP') || 
                duckType.includes('TIME')) {
          classification = 'date';
        }
        
        return {
          columnName: row.column_name,
          displayName: row.column_name,
          alias: transliterate(row.column_name) || `col_${idx}`,
          classification,
          description: `Из файла ${fileName}`
        };
      });
      
      const countResult = await conn!.query(`SELECT COUNT(*) as cnt FROM ${tableName}`);
      const totalRows = Number(toNumber((countResult.toArray()[0]).cnt) ?? 0);
      
      self.postMessage({
        id,
        success: true,
        result: {
          configs,
          totalRows,
          totalColumns: configs.length,
          sheetNames
        }
      });
    }
    
    if (type === 'GET_PREVIEW') {
      const { datasetId, limit } = payload;
      const tableName = buildTableName(datasetId);
      
      try {
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
        
        const safeLimit = Math.max(1, Math.min(limit, 5000));
        const table = await conn!.query(`SELECT * FROM ${tableName} LIMIT ${safeLimit}`);
        
        const rows = table.toArray().map(row => {
          const obj: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(row)) {
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
        const checkTable = await conn!.query(`
          SELECT COUNT(*) as cnt 
          FROM information_schema.tables 
          WHERE table_name = '${tableName}'
        `);
        const tableExists = (checkTable.toArray()[0])?.cnt > 0;
        
        if (!tableExists) {
          throw new Error(`Table ${tableName} does not exist`);
        }
        
        const table = await conn!.query(`SELECT * FROM ${tableName}`);

        const { tableToIPC } = await import('apache-arrow');
        const arrowBuffer = tableToIPC(table, 'stream');
        
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