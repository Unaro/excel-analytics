// shared/lib/computation/lib/duckdb/chunked-export.ts
// ─────────────────────────────────────────────────────────────
// Chunked Arrow export — защита от OOM при 1M+ строк.
//
// Разбивает таблицу на chunks по CHUNK_SIZE строк, каждый
// экспортируется отдельно и отправляется как Transferable.
//
// Это даёт:
//   - Снижение пикового потребления памяти в ~CHUNKS раз
//   - Возможность прогресс-репорта из worker'а
//   - Надёжное сохранение в IndexedDB (маленькие chunks)
// ─────────────────────────────────────────────────────────────

import { tableToIPC, Table } from 'apache-arrow';

export const CHUNK_SIZE = 100_000;

export interface ExportChunk {
  index: number;
  buffer: Uint8Array;
  rowsInChunk: number;
  isLast: boolean;
}

/**
 * Генератор, который последовательно экспортирует chunks таблицы.
 * Между chunk'ами можно отдавать управление (через await 0),
 * чтобы не блокировать event loop.
 */
export async function* exportTableInChunks(
  table: Table
): AsyncGenerator<ExportChunk, void, void> {
  const totalRows = table.numRows;
  const totalChunks = Math.ceil(totalRows / CHUNK_SIZE);

  for (let i = 0; i < totalChunks; i++) {
    const offset = i * CHUNK_SIZE;
    const length = Math.min(CHUNK_SIZE, totalRows - offset);

    const slice = table.slice(offset, offset + length);
    const buffer = tableToIPC(slice, 'stream');

    yield {
      index: i,
      buffer,
      rowsInChunk: length,
      isLast: i === totalChunks - 1,
    };

    // Отдаём управление event loop после каждого chunk
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/**
 * Синхронная версия для случаев, когда прогресс не нужен.
 * Возвращает массив буферов.
 */
export function exportTableChunksSync(table: Table): Uint8Array[] {
  const totalRows = table.numRows;
  const chunks: Uint8Array[] = [];

  for (let offset = 0; offset < totalRows; offset += CHUNK_SIZE) {
    const length = Math.min(CHUNK_SIZE, totalRows - offset);
    const slice = table.slice(offset, offset + length);
    chunks.push(tableToIPC(slice, 'stream'));
  }

  return chunks;
}