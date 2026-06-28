/// <reference lib="webworker" />

import { logger } from '@/shared/lib/logger';
import { buildTableName } from '../../table-name';
import { requireConn } from '../runtime';
import type { GetColumnPairsPayload } from '../messages';

/** GET_COLUMN_PAIRS — пары «ключ → значение» для словаря справочника. */
export async function handleGetColumnPairs(id: number, payload: GetColumnPairsPayload): Promise<void> {
  const conn = requireConn();
  const { datasetId, keyColumn, valueColumn } = payload;
  const tableName = buildTableName(datasetId);
  // Идентификаторы экранируются кавычками (имена колонок приходят
  // из DESCRIBE-конфигов, но защищаемся как везде в компиляторе)
  const qk = `"${keyColumn.replace(/"/g, '""')}"`;
  const qv = `"${valueColumn.replace(/"/g, '""')}"`;

  try {
    const table = await conn.query(
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
