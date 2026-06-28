/// <reference lib="webworker" />

import { logger } from '@/shared/lib/logger';
import { buildTableName } from '../../table-name';
import { requireConn, getConn, invalidateTableCaches } from '../runtime';
import type { DropTablePayload, CheckTablePayload } from '../messages';

/** DROP_TABLE — удаление таблицы датасета и сброс её кэшей. */
export async function handleDropTable(id: number, payload: DropTablePayload): Promise<void> {
  const conn = requireConn();
  const { datasetId } = payload;
  const tableName = buildTableName(datasetId);
  try {
    await conn.query(`DROP TABLE IF EXISTS ${tableName}`);
    invalidateTableCaches(tableName);
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

/** CHECK_TABLE — существует ли таблица датасета (ошибку трактуем как «нет»). */
export async function handleCheckTable(id: number, payload: CheckTablePayload): Promise<void> {
  const conn = getConn();
  if (!conn) {
    self.postMessage({ id, success: true, result: { exists: false } });
    return;
  }

  const { datasetId } = payload;
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
}
