// shared/lib/computation/lib/duckdb/arrow-converter.ts
import type { DatasetRow } from '@/shared/lib/types/dataset';
import { tableToIPC, tableFromJSON, tableFromIPC, Table } from 'apache-arrow';

function normalizeArrowValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return isFinite(value) ? value : null;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value.toISOString().split('T')[0];
  }
  return String(value);
}

function arrowTableToRows(table: Table): DatasetRow[] {
  const rows: DatasetRow[] = [];
  const fieldNames = table.schema.fields.map((f) => f.name);
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
 * Сериализует строки датасета в Arrow IPC-буфер (stream-формат) —
 * формат персистентности данных в IndexedDB (`arrow:<id>`).
 */
export function rowsToArrowBuffer(rows: DatasetRow[]): Uint8Array {
  if (rows.length === 0) return new Uint8Array(0);
  const table = tableFromJSON(rows);
  return tableToIPC(table, 'stream');
}

/**
 * Десериализует Arrow IPC-буфер обратно в строки датасета
 * (нормализуя bigint → number, Date → ISO-дату, NaN/Infinity → null).
 */
export function arrowBufferToRows(buffer: Uint8Array): DatasetRow[] {
  if (buffer.byteLength === 0) return [];
  const table = tableFromIPC(buffer);
  return arrowTableToRows(table);
}