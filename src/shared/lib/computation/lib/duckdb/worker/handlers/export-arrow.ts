/// <reference lib="webworker" />

import { logger } from '@/shared/lib/logger';
import { buildTableName } from '../../table-name';
import { exportTableInChunks } from '../../chunked-export';
import { requireConn } from '../runtime';
import type { ExportArrowPayload } from '../messages';

/** Существует ли таблица датасета в DuckDB. */
async function tableExists(
  conn: ReturnType<typeof requireConn>,
  tableName: string
): Promise<boolean> {
  const checkTable = await conn.query(`
    SELECT COUNT(*) as cnt
    FROM information_schema.tables
    WHERE table_name = '${tableName}'
  `);
  const cnt = (checkTable.toArray()[0] as Record<string, unknown>)?.cnt;
  return typeof cnt === 'number'
    ? cnt > 0
    : typeof cnt === 'bigint'
      ? Number(cnt) > 0
      : false;
}

/** EXPORT_ARROW — выгрузка всей таблицы одним Arrow-буфером (Transferable). */
export async function handleExportArrow(id: number, payload: ExportArrowPayload): Promise<void> {
  const conn = requireConn();
  const { datasetId } = payload;
  const tableName = buildTableName(datasetId);

  try {
    if (!(await tableExists(conn, tableName))) {
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

/** EXPORT_ARROW_CHUNKED — потоковая выгрузка таблицы чанками (каждый Transferable). */
export async function handleExportArrowChunked(id: number, payload: ExportArrowPayload): Promise<void> {
  const conn = requireConn();
  const { datasetId } = payload;
  const tableName = buildTableName(datasetId);

  try {
    if (!(await tableExists(conn, tableName))) {
      throw new Error(`Table ${tableName} does not exist`);
    }

    const table = await conn.query(`SELECT * FROM ${tableName}`);
    const totalRows = table.numRows;

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
