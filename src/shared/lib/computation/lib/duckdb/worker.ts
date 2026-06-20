/// <reference lib="webworker" />

import { logger } from '@/shared/lib/logger';
import * as duckdb from '@duckdb/duckdb-wasm';
import { tableFromIPC, tableFromJSON } from 'apache-arrow';
import { compileQuery, BREAKDOWN_LIMIT } from '../query-compiler';
import { postProcessAggregates, recalculateFormulasOnAggregated } from '../post-process';
import { getActiveFilter, formatValue } from '../utils';
import { transliterate } from '@/shared/lib/utils/translit';
import { aggregateProcessedRows } from '../aggregation';
import type { ClientComputeParams } from '../types';
import { buildTableName } from './table-name';
import { exportTableInChunks } from './chunked-export';
import { preparedStatementCache } from './prepared-statement-cache';
import { parseExcelToJson, classifyColumn, type ParseTimings } from './excel-parser';
import { DatasetRow } from '@/shared/lib/types';

/**
 * Отдаёт управление event loop.
 * Критично для длительных операций в Worker'е:
 *   - Позволяет обработать входящие сообщения (PING)
 *   - Даёт V8 возможность запустить GC
 *   - Предотвращает "Worker timeout" в Manager
 */
function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Логирует разбивку времени импорта по фазам (профилирование больших файлов).
 *
 * Парсинг делится на read (XLSX.read), toJson (sheet_to_json) и normalize
 * (normalizeValue/регэкспы); вставка — единой фазой. Лог идёт через
 * logger.info (виден только в dev), throughput — строк/сек по самой долгой
 * стадии, чтобы сразу видеть узкое место.
 */
function logImportTimings(
  strategy: 'csv' | 'batched',
  parse: ParseTimings,
  insertMs: number,
  rows: number
): void {
  const totalMs = parse.totalMs + insertMs;
  const pct = (ms: number) => `${Math.round((ms / totalMs) * 100)}%`;
  const rps = (ms: number) => (ms > 0 ? Math.round(rows / (ms / 1000)).toLocaleString() : '∞');
  logger.info(
    `[Worker] ⏱️ Import profile (${strategy}, ${rows.toLocaleString()} rows, ` +
      `${Math.round(totalMs)}ms, ${rps(totalMs)} rows/s):\n` +
      `  read=${Math.round(parse.readMs)}ms (${pct(parse.readMs)}) · ` +
      `toJson=${Math.round(parse.toJsonMs)}ms (${pct(parse.toJsonMs)}) · ` +
      `normalize=${Math.round(parse.normalizeMs)}ms (${pct(parse.normalizeMs)}) · ` +
      `insert=${Math.round(insertMs)}ms (${pct(insertMs)})`
  );
}

/**
 * Собирает сэмпл значений по каждой колонке для классификации.
 */
function buildClassificationSample(
  headers: string[],
  rows: DatasetRow[]
): Record<string, unknown[]> {
  const sample: Record<string, unknown[]> = {};
  for (const h of headers) sample[h] = [];
  for (const row of rows) {
    for (const h of headers) {
      sample[h].push(row[h]);
    }
  }
  return sample;
}

/**
 * Конвертирует DatasetRow[] в CSV-буфер (для маленьких файлов).
 * Простая реализация без внешних зависимостей.
 */
function rowsToCsvBuffer(
  rows: DatasetRow[],
  headers: string[]
): Uint8Array {
  const lines: string[] = [];
  // Header
  lines.push(headers.map(escapeCsvField).join(','));
  // Rows
  for (const row of rows) {
    const values = headers.map((h) => {
      const v = row[h];
      if (v === null || v === undefined) return '';
      return escapeCsvField(String(v));
    });
    lines.push(values.join(','));
  }
  return new TextEncoder().encode(lines.join('\n'));
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}


// ─────────────────────────────────────────────────────────────
// 1. СТРОГИЕ ТИПЫ ДЛЯ СООБЩЕНИЙ
// ─────────────────────────────────────────────────────────────

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

export interface PingPayload {
  datasetId?: string;
}

export interface CheckTablePayload {
  datasetId: string;
}

export interface ReloadArrowPayload {
  datasetId: string;
  buffer: Uint8Array;
}

export interface CancelPayload {
  /** id COMPUTE-сообщения, результат которого больше не нужен. */
  targetId: number;
}

export interface GetColumnPairsPayload {
  datasetId: string;
  keyColumn: string;
  valueColumn: string;
}

export interface ConfigureEnginePayload {
  /** Потолок памяти DuckDB в МБ; null — снять явный лимит. */
  memoryLimitMB: number | null;
}

export type WorkerMessage =
  | { type: 'CONFIGURE_ENGINE'; id: number; payload: ConfigureEnginePayload }
  | { type: 'REGISTER_ARROW'; id: number; payload: RegisterArrowPayload }
  | { type: 'COMPUTE'; id: number; payload: ComputePayload }
  | { type: 'IMPORT_EXCEL'; id: number; payload: ImportExcelPayload }
  | { type: 'GET_PREVIEW'; id: number; payload: GetPreviewPayload }
  | { type: 'EXPORT_ARROW'; id: number; payload: ExportArrowPayload }
  | { type: 'DROP_TABLE'; id: number; payload: DropTablePayload }
  | { type: 'PING'; id: number; payload: PingPayload }
  | { type: 'CHECK_TABLE'; id: number; payload: CheckTablePayload }
  | { type: 'RELOAD_ARROW'; id: number; payload: ReloadArrowPayload }
  | { type: 'EXPORT_ARROW_CHUNKED'; id: number; payload: ExportArrowPayload }
  | { type: 'CANCEL'; id: number; payload: CancelPayload }
  | { type: 'GET_COLUMN_PAIRS'; id: number; payload: GetColumnPairsPayload }

// ─────────────────────────────────────────────────────────────
// 2. ХЕЛПЕРЫ
// ─────────────────────────────────────────────────────────────

function toAbsoluteUrl(path: string): string {
  return new URL(path, self.location.origin).href;
}

/**
 * Безопасное приведение значения из DuckDB к числу.
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

// ─────────────────────────────────────────────────────────────
// 3. КОНФИГУРАЦИЯ BUNDLES
// ─────────────────────────────────────────────────────────────

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

// Настройки движка (память ↔ время). Хранятся на уровне модуля, чтобы
// переживать пересоздание соединения и переприменяться после каждого initDB.
// Менеджер пересылает их заново при перезапуске самого воркера.
let engineConfig: ConfigureEnginePayload | null = null;

/**
 * Применяет текущие настройки движка к открытому соединению.
 *
 * Управляем только `memory_limit` — ограничение пиковой памяти (ценой
 * возможного замедления). `threads` НЕ трогаем: wasm-сборка EH скомпилирована
 * без потоков, и любой `SET/RESET threads` бросает «compiled without threads».
 */
async function applyEngineConfig(): Promise<void> {
  if (!conn || !engineConfig) return;
  const { memoryLimitMB } = engineConfig;
  try {
    if (memoryLimitMB != null && memoryLimitMB > 0) {
      await conn.query(`SET memory_limit='${memoryLimitMB}MB'`);
    } else {
      // Снятие лимита: вернуть дефолт DuckDB.
      await conn.query(`RESET memory_limit`);
    }
    logger.debug('[DuckDB] ⚙️ Engine config applied:', engineConfig);
  } catch (err) {
    logger.warn('[DuckDB] Failed to apply engine config:', err);
  }
}

async function loadWorkerScript(workerUrl: string): Promise<Worker> {
  try {
    return new Worker(workerUrl);
  } catch (directErr) {
    logger.warn('[DuckDB] Direct worker load failed, using blob fallback:', directErr);
  }
  const response = await fetch(workerUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch worker script: ${response.status} ${response.statusText} from ${workerUrl}`
    );
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
      const duckdbLogger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
      db = new duckdb.AsyncDuckDB(duckdbLogger, worker);
      await db.instantiate(EH_BUNDLE.mainModule);
      conn = await db.connect();
      logger.debug('[DuckDB] ✅ Initialized with EH bundle');
      preparedStatementCache.bind(conn);
      await applyEngineConfig();
    } catch (ehError) {
      logger.warn('[DuckDB] EH bundle failed, falling back to MVP:', ehError);
      try {
        const worker = await loadWorkerScript(MVP_BUNDLE.mainWorker);
        const duckdbLogger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
        db = new duckdb.AsyncDuckDB(duckdbLogger, worker);
        await db.instantiate(MVP_BUNDLE.mainModule);
        conn = await db.connect();
        logger.debug('[DuckDB] ✅ Initialized with MVP bundle (fallback)');
        preparedStatementCache.bind(conn);
        await applyEngineConfig();
      } catch (mvpError) {
        initPromise = null;
        throw new Error(
          `DuckDB initialization failed: ${
            mvpError instanceof Error ? mvpError.message : 'Unknown'
          }`
        );
      }
    }
  })();

  return initPromise;
}

// ─────────────────────────────────────────────────────────────
// 4. ГЛАВНЫЙ ОБРАБОТЧИК СООБЩЕНИЙ
// ─────────────────────────────────────────────────────────────

// id COMPUTE-задач, отменённых менеджером (AbortSignal в хуках).
// Пока COMPUTE ждёт `await conn.query()` (SQL исполняется во внутреннем
// воркере duckdb-wasm), наш event loop свободен и успевает принять CANCEL —
// контрольные точки в COMPUTE прерывают задачу между этапами.
const cancelledComputeIds = new Set<number>();

function markCancelled(targetId: number): void {
  // CANCEL для уже завершённой задачи оставил бы запись навсегда —
  // страхуемся от неограниченного роста.
  if (cancelledComputeIds.size > 500) cancelledComputeIds.clear();
  cancelledComputeIds.add(targetId);
}

self.onmessage = async (e: MessageEvent) => {
  const { type, payload, id } = e.data as WorkerMessage;

  // CANCEL обрабатываем до initDB: отмена не должна ждать инициализации.
  // Ответ не шлём — менеджер уже отклонил промис задачи на своей стороне.
  if (type === 'CANCEL') {
    markCancelled(payload.targetId);
    return;
  }

  try {
    await initDB();

    if (!conn) {
      throw new Error('DuckDB connection was not established after initDB()');
    }

    // ═══════════════════════════════════════════════════════════
    // CONFIGURE_ENGINE — настройки память ↔ время (memory_limit/threads)
    // ═══════════════════════════════════════════════════════════
    if (type === 'CONFIGURE_ENGINE') {
      engineConfig = payload;
      await applyEngineConfig();
      self.postMessage({ id, success: true });
      return;
    }

    // ═══════════════════════════════════════════════════════════
    // REGISTER_ARROW
    // ═══════════════════════════════════════════════════════════
    if (type === 'REGISTER_ARROW') {
      const { datasetId, buffer } = payload;
      const tableName = buildTableName(datasetId);

      await conn!.query(`DROP TABLE IF EXISTS ${tableName}`);
      preparedStatementCache.invalidateForTable(tableName);

      const arrowTable = tableFromIPC(buffer);
      await conn!.insertArrowTable(arrowTable, { name: tableName });

      self.postMessage({ id, success: true });
    }

    // ═══════════════════════════════════════════════════════════
    // COMPUTE — оптимизированный блок с CTE
    // ═══════════════════════════════════════════════════════════
    if (type === 'COMPUTE') {
      const { params } = payload;
      const { dashboardId, dashboardGroupsConfig, virtualMetrics, filters, groupByColumn } = params;
      const tableName = buildTableName(params.datasetId);

      // Контрольная точка отмены: true — задача снята, ответ уже отправлен.
      const abortIfCancelled = (): boolean => {
        if (!cancelledComputeIds.has(id)) return false;
        cancelledComputeIds.delete(id);
        self.postMessage({ id, success: false, error: 'AbortError' });
        return true;
      };

      if (abortIfCancelled()) return;

      // ─── ПОЛУЧАЕМ РЕАЛЬНУЮ СХЕМУ ИЗ DUCKDB ─────────────────
      let effectiveParams = params;
      try {
        const schemaResult = await conn!.query(`DESCRIBE ${tableName}`);
        const realColumns = schemaResult.toArray().map(
          (r) => (r as Record<string, unknown>)['column_name'] as string
        );
        logger.debug(
          `[Worker] 🔍 DESCRIBE ${tableName}: ${realColumns.length} columns`,
          realColumns
        );
        if (realColumns.length > 0) {
          effectiveParams = { ...params, validColumns: realColumns };
        }
      } catch (schemaErr) {
        logger.warn(
          `[Worker] ⚠️ DESCRIBE failed for ${tableName}, falling back to params.validColumns:`,
          schemaErr
        );
      }

      const compiled = compileQuery(effectiveParams, 'duckdb');

      logger.debug(`[Worker] 📝 Compiled SQL (${compiled.sql.length} chars):`, compiled.sql.slice(0, 200) + '...');

      // Отмена могла прийти, пока ждали DESCRIBE — не запускаем тяжёлый SQL
      if (abortIfCancelled()) return;

      const prepared = await preparedStatementCache.getOrCreate(compiled.sql);
      let table: Awaited<ReturnType<duckdb.AsyncDuckDBConnection['query']>>;

      if (prepared) {
        table = await prepared.query();
      } else {
        table = await conn!.query(compiled.sql);
      }

      // SQL уже исполнен, но пост-обработка и сериализация результата
      // отменённой задачи никому не нужны
      if (abortIfCancelled()) return;

      const allRows = table.toArray() as Record<string, unknown>[];
      // Есть ли группировка (категориальная и/или временна́я)
      const hasGrouping = !!(groupByColumn || params.groupByDateColumn);
      // SQL запрашивает BREAKDOWN_LIMIT + 1 строк: наличие лишней строки —
      // признак усечения. Обрезаем ДО пост-обработки, чтобы сводка («Итого»)
      // и breakdown считались по одному набору строк.
      const breakdownTruncated =
        hasGrouping && allRows.length > BREAKDOWN_LIMIT;
      const rows = breakdownTruncated ? allRows.slice(0, BREAKDOWN_LIMIT) : allRows;
      const processedRows = postProcessAggregates(rows, compiled);

      const computeTotalRecordCount = (sqlRows: Record<string, unknown>[]): number => {
        let total = 0;
        for (const row of sqlRows) {
          const rc = row['_record_count'];
          if (typeof rc === 'number' && isFinite(rc)) {
            total += rc;
          } else if (typeof rc === 'bigint') {
            total += Number(rc);
          }
        }
        return total;
      };

      const groups = dashboardGroupsConfig
        .filter(cfg => cfg.enabled)
        .map(cfg => {
          const groupDef = effectiveParams.groups.find(g => g.id === cfg.groupId);

          const breakdownItems = hasGrouping
            ? processedRows
                .map((processed, idx) => {
                  const rawLabel = rows[idx]['_group_label'];
                  const label =
                    rawLabel === null || rawLabel === undefined
                      ? ''
                      : String(rawLabel).trim();
                  const rawDate = rows[idx]['_date_label'];
                  const dateLabel =
                    rawDate === null || rawDate === undefined
                      ? undefined
                      : String(rawDate).trim();
                  const rowRc = rows[idx]['_record_count'];
                  const recordCount =
                    typeof rowRc === 'number'
                      ? rowRc
                      : typeof rowRc === 'bigint'
                        ? Number(rowRc)
                        : 0;
                  const groupVirtualMetrics = virtualMetrics.map(vm => {
                    const binding = cfg.virtualMetricBindings?.find(
                      b => b.virtualMetricId === vm.id
                    );
                    if (!binding) {
                      return {
                        virtualMetricId: vm.id,
                        virtualMetricName: vm.name,
                        value: null,
                        formattedValue: '—',
                        sourceMetricId: '',
                      };
                    }
                    const alias = `${cfg.groupId}__${binding.metricId}`;
                    const numericValue =
                      typeof processed[alias] === 'number' ? processed[alias] : null;
                    return {
                      virtualMetricId: vm.id,
                      virtualMetricName: vm.name,
                      value: numericValue,
                      formattedValue: formatValue(
                        numericValue,
                        vm.displayFormat,
                        vm.decimalPlaces,
                        vm.unit
                      ),
                      sourceMetricId: binding.metricId,
                    };
                  });
                  return { label, dateLabel, recordCount, virtualMetrics: groupVirtualMetrics };
                })
                .filter(item => item.label !== '')
            : undefined;

          let summaryProcessed: Record<string, number | null>;
          if (hasGrouping) {
            summaryProcessed = aggregateProcessedRows(
              processedRows,
              compiled.aggregateMetadata,
              compiled.formulas
            );
          } else {
            summaryProcessed = processedRows[0] || {};
          }

          const groupVirtualMetrics = virtualMetrics.map(vm => {
            const binding = cfg.virtualMetricBindings?.find(
              b => b.virtualMetricId === vm.id
            );
            if (!binding) {
              return {
                virtualMetricId: vm.id,
                virtualMetricName: vm.name,
                value: null,
                formattedValue: '—',
                sourceMetricId: '',
              };
            }
            const alias = `${cfg.groupId}__${binding.metricId}`;
            const numericValue =
              typeof summaryProcessed[alias] === 'number'
                ? summaryProcessed[alias]
                : null;
            return {
              virtualMetricId: vm.id,
              virtualMetricName: vm.name,
              value: numericValue,
              formattedValue: formatValue(
                numericValue,
                vm.displayFormat,
                vm.decimalPlaces,
                vm.unit
              ),
              sourceMetricId: binding.metricId,
            };
          });

          return {
            groupId: cfg.groupId,
            groupName: groupDef?.name ?? `Группа ${cfg.groupId}`,
            virtualMetrics: groupVirtualMetrics,
            breakdown: breakdownItems,
            breakdownTruncated,
            recordCount: computeTotalRecordCount(rows),
            computedAt: Date.now(),
          };
        });

      const result = {
        dashboardId,
        hierarchyFilters: filters,
        activeFilter: getActiveFilter(filters),
        virtualMetrics,
        groups,
        totalRecords: computeTotalRecordCount(rows),
        computedAt: Date.now(),
      };

      self.postMessage({ id, success: true, result });
    }

    if (type === 'IMPORT_EXCEL') {
      const { datasetId, fileName, buffer } = payload;
      const tableName = buildTableName(datasetId);

      try {
        // ─── ЭТАП 1: Парсинг Excel в JSON ───────────────────────
        await yieldToEventLoop();

        const { flatRows, sheetNames, headers, timings } = parseExcelToJson(buffer);

        if (flatRows.length === 0) {
          throw new Error('Файл пуст или не содержит валидных данных');
        }

        logger.debug(
          `[Worker] 📄 Parsed ${flatRows.length} rows, ${headers.length} columns from ${fileName}`
        );

        // ─── ЭТАП 2: Выбор стратегии импорта ────────────────────
        const BATCH_THRESHOLD = 50_000;
        const useBatchedInsert = flatRows.length > BATCH_THRESHOLD;

        // Профилирование импорта (см. ROADMAP «Производительность обработки
        // файлов»): засекаем фазу вставки, чтобы сопоставить с фазами парсинга.
        const tInsertStart = performance.now();

        await conn.query(`DROP TABLE IF EXISTS ${tableName}`);

        let classificationSample: Record<string, unknown[]> = {};

        if (useBatchedInsert) {
          // ═══════════════════════════════════════════════════════
          // СТРАТЕГИЯ A: Batched Arrow insert (для больших файлов)
          // ═══════════════════════════════════════════════════════
          const BATCH_SIZE = 25_000;
          const totalBatches = Math.ceil(flatRows.length / BATCH_SIZE);

          for (let i = 0; i < flatRows.length; i += BATCH_SIZE) {
            const chunk = flatRows.slice(i, i + BATCH_SIZE);
            const isFirstBatch = i === 0;
            const batchIndex = Math.floor(i / BATCH_SIZE) + 1;

            const arrowTable = tableFromJSON(chunk);
            
            if (isFirstBatch) {
              // Первый батч — создаём таблицу
              await conn.insertArrowTable(arrowTable, {
                name: tableName,
                create: true,
              });
            } else {
              const tempTableName = `${tableName}_batch_${batchIndex}`;
              await conn.insertArrowTable(arrowTable, {
                name: tempTableName,
                create: true,
              });
              
              // Явный INSERT INTO — гарантированно добавляет данные
              await conn.query(
                `INSERT INTO ${tableName} SELECT * FROM ${tempTableName}`
              );
              
              // Удаляем временную таблицу
              await conn.query(`DROP TABLE IF EXISTS ${tempTableName}`);
            }

            // Отдаём управление event loop между батчами
            await yieldToEventLoop();

            // Прогресс-репорт в UI
            if (batchIndex % 5 === 0 || batchIndex === totalBatches) {
              self.postMessage({
                id,
                type: 'PROGRESS',
                progress: {
                  phase: 'import',
                  current: i + chunk.length,
                  total: flatRows.length,
                  percent: Math.round(((i + chunk.length) / flatRows.length) * 100),
                },
              });
            }
          }

          const countResult = await conn.query(
            `SELECT COUNT(*) as cnt FROM ${tableName}`
          );
          const actualRows = Number(
            toNumber((countResult.toArray()[0] as Record<string, unknown>).cnt) ?? 0
          );
          
          logger.debug(
            `[Worker] ✅ Batched insert completed: ${totalBatches} batches, ` +
            `${actualRows.toLocaleString()} rows in table (expected: ${flatRows.length.toLocaleString()})`
          );
          
          if (actualRows !== flatRows.length) {
            logger.warn(
              `[Worker] ⚠️ Row count mismatch! Expected ${flatRows.length}, got ${actualRows}. ` +
              `Some batches may have failed silently.`
            );
          }

          // Сэмпл для классификации
          const sampleRows = flatRows.slice(0, 100);
          classificationSample = buildClassificationSample(headers, sampleRows);
        } else {
          // ═══════════════════════════════════════════════════════
          // СТРАТЕГИЯ B: CSV через read_csv_auto (для маленьких файлов)
          // ═══════════════════════════════════════════════════════
          const csvBuffer = rowsToCsvBuffer(flatRows, headers);
          const csvFileName = `${datasetId}_import.csv`;
          db!.registerFileBuffer(csvFileName, csvBuffer);

          await conn.query(`
            CREATE TABLE ${tableName} AS
            SELECT * FROM read_csv_auto(
              '${csvFileName}',
              sample_size = 20000,
              auto_detect = true,
              ignore_errors = true,
              null_padding = true,
              all_varchar = false,
              delim = ',',
              quote = '"'
            )
          `);

          // Приведение TIME-типов к VARCHAR
          const schemaResult = await conn.query(`DESCRIBE ${tableName}`);
          const schemaRows = schemaResult.toArray() as Array<{
            column_name: string;
            column_type: string;
          }>;
          for (const row of schemaRows) {
            const duckType = row.column_type.toUpperCase();
            if (duckType === 'TIME' || duckType === 'TIME WITH TIME ZONE') {
              await conn.query(
                `ALTER TABLE ${tableName} ALTER COLUMN "${row.column_name}" TYPE VARCHAR`
              );
            }
          }

          const descResult = await conn.query(`DESCRIBE ${tableName}`);
          const finalSchema = descResult.toArray() as Array<{
            column_name: string;
            column_type: string;
          }>;

          const configs = finalSchema.map((row, idx) => {
            const duckType = row.column_type.toUpperCase();
            let classification: 'numeric' | 'date' | 'categorical' = 'categorical';
            if (
              duckType.includes('INT') ||
              duckType.includes('DECIMAL') ||
              duckType.includes('FLOAT') ||
              duckType.includes('DOUBLE') ||
              duckType.includes('NUMERIC') ||
              duckType.includes('HUGEINT')
            ) {
              classification = 'numeric';
            } else if (duckType.includes('DATE') || duckType.includes('TIMESTAMP')) {
              classification = 'date';
            }
            return {
              columnName: row.column_name,
              displayName: row.column_name,
              alias: transliterate(row.column_name) || `col_${idx}`,
              classification,
              description: `Из файла ${fileName}`,
            };
          });

          const countResult = await conn.query(
            `SELECT COUNT(*) as cnt FROM ${tableName}`
          );
          const totalRows = Number(
            toNumber((countResult.toArray()[0] as Record<string, unknown>).cnt) ?? 0
          );

          logImportTimings('csv', timings, performance.now() - tInsertStart, flatRows.length);

          self.postMessage({
            id,
            success: true,
            result: {
              configs,
              totalRows,
              totalColumns: configs.length,
              sheetNames,
            },
          });
          return;
        }

        // ─── ЭТАП 3: Построение конфигов (для стратегии A) ──────
        const configs = headers.map((col, idx) => {
          const sample = classificationSample[col] ?? [];
          const classification = classifyColumn(sample);
          return {
            columnName: col,
            displayName: col,
            alias: transliterate(col) || `col_${idx}`,
            classification,
            description: `Из файла ${fileName}`,
          };
        });

        const finalCountResult = await conn.query(
          `SELECT COUNT(*) as cnt FROM ${tableName}`
        );
        const finalTotalRows = Number(
          toNumber((finalCountResult.toArray()[0] as Record<string, unknown>).cnt) ?? 0
        );

        logImportTimings('batched', timings, performance.now() - tInsertStart, flatRows.length);

        self.postMessage({
          id,
          success: true,
          result: {
            configs,
            totalRows: finalTotalRows,
            totalColumns: configs.length,
            sheetNames,
          },
        });
      } catch (err) {
        logger.error('[Worker] IMPORT_EXCEL failed:', err);
        self.postMessage({
          id,
          success: false,
          error: err instanceof Error ? err.message : 'Import failed',
        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // GET_COLUMN_PAIRS — пары «ключ → значение» для словаря справочника
    // ═══════════════════════════════════════════════════════════
    if (type === 'GET_COLUMN_PAIRS') {
      const { datasetId, keyColumn, valueColumn } = payload;
      const tableName = buildTableName(datasetId);
      // Идентификаторы экранируются кавычками (имена колонок приходят
      // из DESCRIBE-конфигов, но защищаемся как везде в компиляторе)
      const qk = `"${keyColumn.replace(/"/g, '""')}"`;
      const qv = `"${valueColumn.replace(/"/g, '""')}"`;

      try {
        const table = await conn!.query(
          `SELECT CAST(${qk} AS VARCHAR) AS k, CAST(${qv} AS VARCHAR) AS v ` +
          `FROM ${tableName} WHERE ${qk} IS NOT NULL AND ${qv} IS NOT NULL`
        );
        const pairs: Array<[string, string]> = table
          .toArray()
          .map((row) => {
            const r = row as { k: unknown; v: unknown };
            return [String(r.k).trim(), String(r.v).trim()] as [string, string];
          })
          .filter(([k, v]) => k !== '' && v !== '');

        self.postMessage({ id, success: true, result: pairs });
      } catch (err) {
        logger.error('[Worker] GET_COLUMN_PAIRS failed:', err);
        self.postMessage({
          id,
          success: false,
          error: err instanceof Error ? err.message : 'Column pairs fetch failed',
        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // GET_PREVIEW
    // ═══════════════════════════════════════════════════════════
    if (type === 'GET_PREVIEW') {
      const { datasetId, limit } = payload;
      const tableName = buildTableName(datasetId);

      try {
        const checkTable = await conn.query(`
          SELECT COUNT(*) as cnt
          FROM information_schema.tables
          WHERE table_name = '${tableName}'
        `);
        const tableExists = (checkTable.toArray()[0] as Record<string, unknown>)?.cnt;
        const exists =
          typeof tableExists === 'number'
            ? tableExists > 0
            : typeof tableExists === 'bigint'
              ? Number(tableExists) > 0
              : false;

        if (!exists) {
          self.postMessage({ id, success: true, result: [] });
          return;
        }

        const safeLimit = Math.max(1, Math.min(limit, 5000));
        const table = await conn.query(`SELECT * FROM ${tableName} LIMIT ${safeLimit}`);

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
        logger.error('[Worker] GET_PREVIEW failed:', err);
        self.postMessage({
          id,
          success: false,
          error: err instanceof Error ? err.message : 'Preview fetch failed',
        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // EXPORT_ARROW
    // ═══════════════════════════════════════════════════════════
    if (type === 'EXPORT_ARROW') {
      const { datasetId } = payload;
      const tableName = buildTableName(datasetId);

      try {
        const checkTable = await conn.query(`
          SELECT COUNT(*) as cnt
          FROM information_schema.tables
          WHERE table_name = '${tableName}'
        `);
        const tableExists = (checkTable.toArray()[0] as Record<string, unknown>)?.cnt;
        const exists =
          typeof tableExists === 'number'
            ? tableExists > 0
            : typeof tableExists === 'bigint'
              ? Number(tableExists) > 0
              : false;

        if (!exists) {
          throw new Error(`Table ${tableName} does not exist`);
        }

        const table = await conn.query(`SELECT * FROM ${tableName}`);
        const { tableToIPC } = await import('apache-arrow');
        const arrowBuffer = tableToIPC(table, 'stream');
        

        self.postMessage({ id, success: true, result: arrowBuffer }, [
          arrowBuffer.buffer as ArrayBuffer,
        ]);
      } catch (err) {
        logger.error('[Worker] EXPORT_ARROW failed:', err);
        self.postMessage({
          id,
          success: false,
          error: err instanceof Error ? err.message : 'Export failed',
        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // DROP_TABLE
    // ═══════════════════════════════════════════════════════════
    if (type === 'DROP_TABLE') {
      const { datasetId } = payload;
      const tableName = buildTableName(datasetId);
      try {
        await conn!.query(`DROP TABLE IF EXISTS ${tableName}`);
        preparedStatementCache.invalidateForTable(tableName);
        logger.debug(`[Worker] Dropped table: ${tableName}`);
        self.postMessage({ id, success: true });
      } catch (err) {
        logger.error('[Worker] DROP_TABLE failed:', err);
        self.postMessage({
          id,
          success: false,
          error: err instanceof Error ? err.message : 'Drop table failed',
        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // PING — расширенный health-check
    // ═══════════════════════════════════════════════════════════
    if (type === 'PING') {
      const pingPayload = payload as PingPayload;

      if (!db || !conn) {
        self.postMessage({
          id,
          success: true,
          result: {
            alive: true,
            dbInitialized: false,
            tableExists: false,
            uptime: 0,
          },
        });
        return;
      }

      let tableExists = false;
      if (pingPayload.datasetId) {
        const tableName = buildTableName(pingPayload.datasetId);
        try {
          const checkResult = await conn.query(`
            SELECT COUNT(*) as cnt
            FROM information_schema.tables
            WHERE table_name = '${tableName}'
          `);
          const checkRow = checkResult.toArray()[0] as Record<string, unknown>;
          const cnt = checkRow?.cnt;
          tableExists =
            typeof cnt === 'number'
              ? cnt > 0
              : typeof cnt === 'bigint'
                ? Number(cnt) > 0
                : false;
        } catch (checkErr) {
          logger.warn('[Worker] PING table check failed:', checkErr);
          tableExists = false;
        }
      }

      self.postMessage({
        id,
        success: true,
        result: {
          alive: true,
          dbInitialized: true,
          tableExists,
          uptime: Date.now(),
        },
      });
      return;
    }

    if (type === 'EXPORT_ARROW_CHUNKED') {
      const { datasetId } = payload;
      const tableName = buildTableName(datasetId);

      try {
        const checkTable = await conn!.query(`
          SELECT COUNT(*) as cnt
          FROM information_schema.tables
          WHERE table_name = '${tableName}'
        `);
        const tableExists = (checkTable.toArray()[0] as Record<string, unknown>)?.cnt;
        const exists =
          typeof tableExists === 'number'
            ? tableExists > 0
            : typeof tableExists === 'bigint'
              ? Number(tableExists) > 0
              : false;

        if (!exists) {
          throw new Error(`Table ${tableName} does not exist`);
        }

        const table = await conn!.query(`SELECT * FROM ${tableName}`);
        const totalRows = table.numRows;

        let chunkIndex = 0;
        for await (const chunk of exportTableInChunks(table)) {
          // Отправляем каждый chunk отдельно как Transferable
          self.postMessage(
            {
              id,
              success: true,
              result: {
                type: 'chunk',
                index: chunk.index,
                totalRows,
                rowsInChunk: chunk.rowsInChunk,
                isLast: chunk.isLast,
                buffer: chunk.buffer,
              },
            },
            [chunk.buffer.buffer]
          );
          chunkIndex++;
        }
      } catch (err) {
        logger.error('[Worker] EXPORT_ARROW_CHUNKED failed:', err);
        self.postMessage({
          id,
          success: false,
          error: err instanceof Error ? err.message : 'Chunked export failed',
        });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // CHECK_TABLE
    // ═══════════════════════════════════════════════════════════
    if (type === 'CHECK_TABLE') {
      await initDB();
      if (!conn) {
        self.postMessage({ id, success: true, result: { exists: false } });
        return;
      }

      const { datasetId } = payload as CheckTablePayload;
      const tableName = buildTableName(datasetId);

      try {
        const checkResult = await conn.query(`
          SELECT COUNT(*) as cnt
          FROM information_schema.tables
          WHERE table_name = '${tableName}'
        `);
        const checkRow = checkResult.toArray()[0] as Record<string, unknown>;
        const cnt = checkRow?.cnt;
        const exists =
          typeof cnt === 'number'
            ? cnt > 0
            : typeof cnt === 'bigint'
              ? Number(cnt) > 0
              : false;

        self.postMessage({ id, success: true, result: { exists } });
      } catch (err) {
        logger.error('[Worker] CHECK_TABLE failed:', err);
        self.postMessage({ id, success: true, result: { exists: false } });
      }
      return;
    }

    // ═══════════════════════════════════════════════════════════
    // RELOAD_ARROW — восстановление таблицы после auto-recovery
    // ═══════════════════════════════════════════════════════════
    if (type === 'RELOAD_ARROW') {
      await initDB();
      if (!conn) {
        throw new Error('DuckDB connection was not established after initDB()');
      }

      const { datasetId, buffer } = payload as ReloadArrowPayload;
      const tableName = buildTableName(datasetId);

      await conn.query(`DROP TABLE IF EXISTS ${tableName}`);
      const arrowTable = tableFromIPC(buffer);
      await conn.insertArrowTable(arrowTable, { name: tableName });

      logger.debug(`[Worker] ♻️ Table ${tableName} reloaded from Arrow buffer`);
      self.postMessage({ id, success: true });
      return;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isCatalogError = message.includes('Catalog Error');

    if (isCatalogError) {
      logger.warn(
        `[Worker] Transient table error (will auto-retry): ${message.split('\n')[0]}`
      );
    } else {
      logger.error('[Worker] Query failed:', error);
    }

    self.postMessage({ id, success: false, error: message });
  }
};