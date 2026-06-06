import { DatasetRow } from '@/entities/dataset';
import { tableToIPC, tableFromJSON, tableFromIPC, Table } from 'apache-arrow';

/**
 * Безопасно конвертирует значение из Arrow в JS-примитив.
 *
 * Arrow возвращает специфичные типы (Int64, Utf8, Date и т.д.),
 * которые нужно привести к DatasetRow: string | number | boolean | null.
 */
function normalizeArrowValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return isFinite(value) ? value : null;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value.toISOString().split('T')[0];
  }
  // Fallback: преобразуем в строку
  return String(value);
}

/**
 * Конвертирует Arrow Table в DatasetRow[] БЕЗ кастов.
 *
 * Проходим по схеме таблицы, гарантируя, что каждая строка
 * соответствует типу DatasetRow (Record<string, string | number | boolean | null>).
 */
function arrowTableToRows(table: Table): DatasetRow[] {
  const rows: DatasetRow[] = [];
  const fieldNames = table.schema.fields.map(f => f.name);

  for (const arrowRow of table) {
    const row: DatasetRow = {};
    for (const name of fieldNames) {
      const raw = (arrowRow as Record<string, unknown>)[name];
      row[name] = normalizeArrowValue(raw);
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Конвертирует DatasetRow[] в Arrow IPC Stream.
 * tableFromJSON корректно выводит типы (числа, строки, null) из объектов.
 */
export function rowsToArrowBuffer(rows: DatasetRow[]): Uint8Array {
  if (rows.length === 0) return new Uint8Array(0);
  const table = tableFromJSON(rows);
  return tableToIPC(table, 'stream');
}

/**
 * Обратная конвертация: Arrow IPC Stream → DatasetRow[].
 * Используется для фоллбэков или экспорта.
 *
 */
export function arrowBufferToRows(buffer: Uint8Array): DatasetRow[] {
  if (buffer.byteLength === 0) return [];
  const table = tableFromIPC(buffer);
  return arrowTableToRows(table);
}