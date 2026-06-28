/// <reference lib="webworker" />

import { logger } from '@/shared/lib/logger';
import { buildTableName } from '../../table-name';
import { requireConn } from '../runtime';
import type { GetPreviewPayload } from '../messages';

/** GET_PREVIEW — первые N строк таблицы для предпросмотра (нормализованные значения). */
export async function handleGetPreview(id: number, payload: GetPreviewPayload): Promise<void> {
  const conn = requireConn();
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
