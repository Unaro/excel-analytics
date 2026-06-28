/// <reference lib="webworker" />

import { logger } from '@/shared/lib/logger';
import { buildTableName } from '../../table-name';
import { getDb, getConn } from '../runtime';
import type { PingPayload } from '../messages';

/** PING — health-check движка (+ опционально наличие таблицы датасета). */
export async function handlePing(id: number, payload: PingPayload): Promise<void> {
  const db = getDb();
  const conn = getConn();

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
  if (payload.datasetId) {
    const tableName = buildTableName(payload.datasetId);
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
}
