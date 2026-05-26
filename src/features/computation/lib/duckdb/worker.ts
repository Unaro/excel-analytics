import * as duckdb from '@duckdb/duckdb-wasm';
import { tableFromIPC, tableFromJSON } from 'apache-arrow';
import { compileQuery } from '../query-compiler';
import { postProcessAggregates } from '../post-process';
import { getActiveFilter, formatValue } from '../utils';
import { transliterate } from '@/shared/lib/utils/translit';

import { ClientComputeParams } from '../types';
import { parseExcelInWorker } from './excel-parser';

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

export type WorkerMessage = 
  | { type: 'REGISTER_ARROW'; id: number; payload: RegisterArrowPayload }
  | { type: 'COMPUTE'; id: number; payload: ComputePayload }
  | { type: 'IMPORT_EXCEL'; id: number; payload: ImportExcelPayload }
  | { type: 'GET_PREVIEW'; id: number; payload: GetPreviewPayload }
  | { type: 'EXPORT_ARROW'; id: number; payload: ExportArrowPayload };

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

async function initDB() {
  if (db) return;
  
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
      console.error('[DuckDB] ❌ Both bundles failed:', mvpError);
      throw new Error(`DuckDB initialization failed: ${mvpError instanceof Error ? mvpError.message : 'Unknown'}`);
    }
  }
}
self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { type, payload, id } = e.data;

  try {
    await initDB();

    if (type === 'REGISTER_ARROW') {
      const { datasetId, buffer } = payload;
      const tableName = `dt_${datasetId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      
      await conn!.query(`DROP TABLE IF EXISTS ${tableName}`);
      
      const arrowTable = tableFromIPC(buffer);
      await conn!.insertArrowTable(arrowTable, { name: tableName });
      
      self.postMessage({ id, success: true });
    }

    if (type === 'COMPUTE') {
      const { params } = payload;
      const { dashboardId, dashboardGroupsConfig, virtualMetrics, filters } = params;
      
      const { sql, formulas } = compileQuery(params, 'duckdb');
      
      // Запрос к DuckDB
      const table = await conn!.query(sql);
      const rows = table.toArray() as Record<string, unknown>[];
      
      // Тяжелая математика тоже выполняется в фоне
      const processed = postProcessAggregates(rows, formulas);
      
      const groups = dashboardGroupsConfig
        .filter(cfg => cfg.enabled)
        .map(cfg => {
          const groupDef = params.groups.find(g => g.id === cfg.groupId);
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
          return {
            groupId: cfg.groupId,
            groupName: groupDef?.name ?? `Группа ${cfg.groupId}`,
            virtualMetrics: groupVirtualMetrics,
            recordCount: rows.length > 0 ? (rows[0]['_record_count'] as number) ?? rows.length : 0,
            computedAt: Date.now()
          };
        });

      const result = {
        dashboardId,
        hierarchyFilters: filters,
        activeFilter: getActiveFilter(filters),
        virtualMetrics,
        groups,
        totalRecords: rows.length,
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

      const flatRows = sheets.flatMap(s => s.rows);
      const headers = sheets[0].headers;
      const tableName = `dt_${datasetId.replace(/[^a-zA-Z0-9_]/g, '_')}`;
      
      await conn!.query(`DROP TABLE IF EXISTS ${tableName}`);

      // 2. Батчинг (Чанкование) для защиты оперативной памяти
      const BATCH_SIZE = 15000; // Обрабатываем по 15к строк за раз
      
      for (let i = 0; i < flatRows.length; i += BATCH_SIZE) {
        const chunk = flatRows.slice(i, i + BATCH_SIZE);
        
        // tableFromJSON конвертирует массив JS-объектов в компактный Arrow-формат
        const arrowTable = tableFromJSON(chunk);
        
        await conn!.insertArrowTable(arrowTable, { name: tableName });
        
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

      // Возвращаем ТОЛЬКО легковесные метаданные обратно в главный поток
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

    // Внутри self.onmessage, после блока IMPORT_EXCEL добавить:
    if (type === 'GET_PREVIEW') {
      const { datasetId, limit } = payload;
      const tableName = `dt_${datasetId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      
      try {
        // Проверяем что таблица существует
        const checkTable = await conn!.query(`
          SELECT COUNT(*) as cnt 
          FROM information_schema.tables 
          WHERE table_name = '${tableName}'
        `);
        const tableExists = (checkTable.toArray()[0] as any)?.cnt > 0;
        
        if (!tableExists) {
          self.postMessage({ 
            id, 
            success: true, 
            result: [] // Пустой массив, не ошибка — UI покажет "нет данных"
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
  const tableName = `dt_${datasetId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  
  try {
    // Проверяем что таблица существует
    const checkTable = await conn!.query(`
      SELECT COUNT(*) as cnt 
      FROM information_schema.tables 
      WHERE table_name = '${tableName}'
    `);
    const tableExists = (checkTable.toArray()[0] as any)?.cnt > 0;
    
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

  } catch (error) {
    self.postMessage({ id, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
};