/// <reference lib="webworker" />

import { logger } from '@/shared/lib/logger';
import { tableFromIPC } from 'apache-arrow';
import { buildTableName } from '../../table-name';
import { requireConn, invalidateTableCaches } from '../runtime';
import type { RegisterArrowPayload, ReloadArrowPayload } from '../messages';

/** REGISTER_ARROW — загрузка Arrow-буфера датасета в таблицу DuckDB. */
export async function handleRegisterArrow(id: number, payload: RegisterArrowPayload): Promise<void> {
  const conn = requireConn();
  const { datasetId, buffer } = payload;
  const tableName = buildTableName(datasetId);

  await conn.query(`DROP TABLE IF EXISTS ${tableName}`);
  invalidateTableCaches(tableName);

  const arrowTable = tableFromIPC(buffer);
  await conn.insertArrowTable(arrowTable, { name: tableName });

  self.postMessage({ id, success: true });
}

/** RELOAD_ARROW — восстановление таблицы после auto-recovery (тот же путь). */
export async function handleReloadArrow(id: number, payload: ReloadArrowPayload): Promise<void> {
  const conn = requireConn();
  const { datasetId, buffer } = payload;
  const tableName = buildTableName(datasetId);

  await conn.query(`DROP TABLE IF EXISTS ${tableName}`);
  invalidateTableCaches(tableName);
  const arrowTable = tableFromIPC(buffer);
  await conn.insertArrowTable(arrowTable, { name: tableName });

  logger.debug(`[Worker] ♻️ Table ${tableName} reloaded from Arrow buffer`);
  self.postMessage({ id, success: true });
}
