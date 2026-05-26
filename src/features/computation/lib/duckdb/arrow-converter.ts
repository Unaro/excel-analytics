import { DatasetRow } from '@/entities/dataset';
import { tableToIPC, tableFromJSON, tableFromIPC } from 'apache-arrow';

/**
 * Конвертирует DatasetRow[] в Arrow IPC Stream
 * tableFromJSON корректно выводит типы (числа, строки, null) из объектов
 */
export function rowsToArrowBuffer(rows: DatasetRow[]): Uint8Array {
  if (rows.length === 0) return new Uint8Array(0);
  // Создаем таблицу из JSON объектов
  const table = tableFromJSON(rows);
  // Сериализуем в бинарный формат (Stream format поддерживается read_arrow)
  return tableToIPC(table, 'stream');
}
/**
 * Обратная конвертация: Arrow IPC Stream → DatasetRow[]
 * Используется для фоллбэков или экспорта
 */
export function arrowBufferToRows(buffer: Uint8Array): DatasetRow[] {
  if (buffer.byteLength === 0) return [];
  const table = tableFromIPC(buffer);
  return table.toArray() as unknown as DatasetRow[];
}

