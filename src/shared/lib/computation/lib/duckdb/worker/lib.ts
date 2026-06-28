/// <reference lib="webworker" />

// Чистые хелперы DuckDB-воркера: профилирование, CSV-сериализация, приведение
// типов, мелочи. Без состояния движка (см. runtime.ts) и без обработчиков команд.

import { logger } from '@/shared/lib/logger';
import type { DatasetRow } from '@/shared/lib/types';
import type { ParseTimings } from '../excel-parser';

/**
 * Отдаёт управление event loop.
 * Критично для длительных операций в Worker'е:
 *   - Позволяет обработать входящие сообщения (PING)
 *   - Даёт V8 возможность запустить GC
 *   - Предотвращает "Worker timeout" в Manager
 */
export function yieldToEventLoop(): Promise<void> {
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
export function logImportTimings(
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
      `header=${Math.round(parse.headerMs)}ms (${pct(parse.headerMs)}) · ` +
      `toJson=${Math.round(parse.toJsonMs)}ms (${pct(parse.toJsonMs)}) · ` +
      `normalize=${Math.round(parse.normalizeMs)}ms (${pct(parse.normalizeMs)}) · ` +
      `insert=${Math.round(insertMs)}ms (${pct(insertMs)})`
  );
}

/**
 * Логирует разбивку времени COMPUTE по фазам (профилирование дашборда).
 *
 * describe — DESCRIBE схемы (метаданные, round-trip на каждый пересчёт);
 * compile — сборка SQL; exec — исполнение запроса DuckDB (скан+агрегация);
 * build — toArray + пост-обработка + сборка групп в JS. Лог через
 * logger.info (только dev), чтобы видеть, что доминирует при смене фильтра.
 */
export function logComputeTimings(p: {
  describeMs: number;
  compileMs: number;
  execMs: number;
  buildMs: number;
  sqlRows: number;
  groups: number;
}): void {
  const total = p.describeMs + p.compileMs + p.execMs + p.buildMs;
  const pct = (ms: number) => `${Math.round((ms / total) * 100)}%`;
  logger.info(
    `[Worker] ⏱️ Compute profile (${Math.round(total)}ms, ` +
      `${p.sqlRows.toLocaleString()} sql-rows, ${p.groups} groups):\n` +
      `  describe=${Math.round(p.describeMs)}ms (${pct(p.describeMs)}) · ` +
      `compile=${Math.round(p.compileMs)}ms (${pct(p.compileMs)}) · ` +
      `exec=${Math.round(p.execMs)}ms (${pct(p.execMs)}) · ` +
      `build=${Math.round(p.buildMs)}ms (${pct(p.buildMs)})`
  );
}

/**
 * Собирает сэмпл значений по каждой колонке для классификации.
 */
export function buildClassificationSample(
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

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Конвертирует DatasetRow[] в CSV-буфер (для маленьких файлов).
 * Простая реализация без внешних зависимостей.
 */
export function rowsToCsvBuffer(rows: DatasetRow[], headers: string[]): Uint8Array {
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

export function toAbsoluteUrl(path: string): string {
  return new URL(path, self.location.origin).href;
}

/**
 * Безопасное приведение значения из DuckDB к числу.
 */
export function toNumber(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return isFinite(val) ? val : null;
  if (typeof val === 'bigint') return Number(val);
  if (typeof val === 'string') {
    const num = Number(val);
    return !isNaN(num) && isFinite(num) ? num : null;
  }
  return null;
}

/** Текстовый файл (CSV/TSV) — всё, что не xlsx/xls. */
export function isCsvFileName(fileName: string): boolean {
  return !/\.(xlsx|xls)$/i.test(fileName);
}

/** Экранирование одинарных кавычек для SQL-строкового литерала. */
export function sqlStr(s: string): string {
  return s.replace(/'/g, "''");
}
