'use server';
import { compileQuery } from '@/shared/lib/computation/lib/query-compiler';
import type { ClientComputeParams } from '@/shared/lib/computation/lib/types';
import { qualifiedTableName } from '@/shared/lib/computation/lib/sql-utils';
import {
  withPgClient,
  type PgConnectionConfig,
} from '@/shared/api/postgres/client';
import {
  ClientComputeParamsSchema,
  PgConfigSchema,
} from './schemas';

export interface PgComputeResult {
  success: true;
  rows: Record<string, unknown>[];
  /**
   * Список колонок таблицы из information_schema — серверный whitelist.
   * Клиент обязан использовать его для локальной перекомпиляции метаданных,
   * чтобы пост-обработка соответствовала фактически исполненному SQL.
   */
  validColumns: string[];
}

/**
 * Server Action: вычисляет метрики дашборда на стороне PostgreSQL.
 *
 * Безопасность (всё клиентское — недоверенный ввод):
 * 1. `params` и `config` валидируются Zod-схемами;
 * 2. клиентские `tableName`/`validColumns` ИГНОРИРУЮТСЯ:
 *    имя таблицы собирается на сервере из `pgSchema`/`pgTable` только после
 *    подтверждения существования таблицы в information_schema,
 *    а whitelist колонок берётся оттуда же;
 * 3. значения фильтров уходят только позиционными параметрами `$n`
 *    (см. compileQuery), идентификаторы — через quoteIdent.
 *
 * @throws Error если параметры невалидны или таблица недоступна.
 */
export async function computePgMetrics(
  rawParams: unknown,
  rawConfig: unknown
): Promise<PgComputeResult> {
  const params = ClientComputeParamsSchema.parse(rawParams);
  const config: PgConnectionConfig = PgConfigSchema.parse(rawConfig);

  return withPgClient(config, async (client) => {
    const columnRows = await client`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = ${params.pgSchema}
        AND table_name = ${params.pgTable}
    `;

    if (columnRows.length === 0) {
      throw new Error(
        `Таблица ${params.pgSchema}.${params.pgTable} не найдена или нет доступа`
      );
    }

    const validColumns = columnRows.map((r) => String(r.column_name));

    const serverParams: ClientComputeParams = {
      ...params,
      tableName: qualifiedTableName(params.pgSchema, params.pgTable),
      validColumns,
    };

    const { sql, params: queryParams } = compileQuery(serverParams, 'postgres');
    const rows = await client.unsafe(sql, queryParams);

    return { success: true as const, rows, validColumns };
  });
}
