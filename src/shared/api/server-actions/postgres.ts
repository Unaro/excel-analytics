// shared/api/server-actions/postgres.ts
'use server';
import { z } from 'zod';
import {
  createPgClient,
  normalizePgRow,
  PgConnectionConfig,
} from '@/shared/api/postgres/client';
import type { DatasetRow } from '@/shared/lib/types/dataset';

const PgConfigSchema = z.object({
  host: z.string().min(1, 'Хост обязателен'),
  port: z.coerce.number().int().min(1).max(65535),
  database: z.string().min(1, 'Имя БД обязательно'),
  user: z.string().min(1, 'Пользователь обязателен'),
  password: z.string(),
  ssl: z.boolean().optional().default(false),
});

const MAX_PREVIEW_LIMIT = 500;
const MAX_SYNC_LIMIT = 50000;

function validateConfig(raw: unknown): PgConnectionConfig {
  return PgConfigSchema.parse(raw);
}

async function withPgClient<T>(
  config: PgConnectionConfig,
  fn: (sql: ReturnType<typeof createPgClient>) => Promise<T>
): Promise<T> {
  let sql: ReturnType<typeof createPgClient> | null = null;
  try {
    sql = createPgClient(config);
    return await fn(sql);
  } finally {
    if (sql) {
      await sql.end({ timeout: 2 }).catch(() => {});
    }
  }
}

export async function testPgConnection(
  rawConfig: unknown
): Promise<{ success: boolean; error?: string }> {
  try {
    const config = validateConfig(rawConfig);
    await withPgClient(config, async (sql) => {
      await sql`SELECT 1`;
    });
    return { success: true };
  } catch (error) {
    console.error('[PG] Connection test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Не удалось подключиться',
    };
  }
}

export type PgSchemaResult =
  | {
      success: true;
      tables: {
        schema: string;
        table: string;
        columns: { name: string; type: string }[];
      }[];
    }
  | { success: false; error: string };

export async function getPgSchema(
  rawConfig: unknown
): Promise<PgSchemaResult> {
  try {
    const config = validateConfig(rawConfig);
    return await withPgClient(config, async (sql) => {
      const tables = await sql`
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
          AND table_type = 'BASE TABLE'
        ORDER BY table_schema, table_name
      `;
      const columns = await sql`
        SELECT table_schema, table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        ORDER BY table_schema, table_name, ordinal_position
      `;

      const schemaMap = new Map<
        string,
        Map<string, { name: string; type: string }[]>
      >();
      for (const col of columns) {
        if (!schemaMap.has(col.table_schema))
          schemaMap.set(col.table_schema, new Map());
        const tableMap = schemaMap.get(col.table_schema)!;
        if (!tableMap.has(col.table_name))
          tableMap.set(col.table_name, []);
        tableMap
          .get(col.table_name)!
          .push({ name: col.column_name, type: col.data_type });
      }

      return {
        success: true,
        tables: tables.map((t) => ({
          schema: t.table_schema,
          table: t.table_name,
          columns:
            schemaMap.get(t.table_schema)?.get(t.table_name) || [],
        })),
      };
    });
  } catch (error) {
    console.error('[PG] Schema fetch failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ошибка чтения схемы',
    };
  }
}

export async function fetchPgTableData(
  rawConfig: unknown,
  schema: string,
  table: string,
  limit: number = MAX_PREVIEW_LIMIT
): Promise<{
  success: boolean;
  rows: DatasetRow[];
  columns: string[];
  totalFetched: number;
  error?: string;
}> {
  try {
    const config = validateConfig(rawConfig);
    return await withPgClient(config, async (sql) => {
      const safeLimit = Math.min(Math.max(1, limit), MAX_SYNC_LIMIT);
      const rows = await sql`
        SELECT * FROM ${sql(schema)}.${sql(table)} LIMIT ${safeLimit}
      `;
      if (!Array.isArray(rows) || rows.length === 0) {
        return {
          success: true,
          rows: [],
          columns: [],
          totalFetched: 0,
        };
      }
      const columns = Object.keys(rows[0]);
      const normalizedRows = rows.map(normalizePgRow);
      return {
        success: true,
        rows: normalizedRows,
        columns,
        totalFetched: normalizedRows.length,
      };
    });
  } catch (error) {
    console.error('[PG] Data fetch failed:', error);
    return {
      success: false,
      rows: [],
      columns: [],
      totalFetched: 0,
      error: error instanceof Error ? error.message : 'Ошибка загрузки данных',
    };
  }
}

export async function refreshPgData(
  rawConfig: unknown,
  schema: string,
  table: string,
  limit: number = MAX_SYNC_LIMIT
): Promise<{
  success: boolean;
  rows: DatasetRow[];
  columns: string[];
  totalFetched: number;
  error?: string;
}> {
  try {
    const config = validateConfig(rawConfig);
    return await withPgClient(config, async (sql) => {
      await sql`SELECT 1`;
      const safeLimit = Math.min(Math.max(1, limit), MAX_SYNC_LIMIT);
      const rows = await sql`
        SELECT * FROM ${sql(schema)}.${sql(table)} LIMIT ${safeLimit}
      `;
      if (!Array.isArray(rows) || rows.length === 0) {
        return {
          success: true,
          rows: [],
          columns: [],
          totalFetched: 0,
        };
      }
      const columns = Object.keys(rows[0]);
      const normalizedRows = rows.map(normalizePgRow);
      return {
        success: true,
        rows: normalizedRows,
        columns,
        totalFetched: normalizedRows.length,
      };
    });
  } catch (error) {
    console.error('[PG] Refresh failed:', error);
    return {
      success: false,
      rows: [],
      columns: [],
      totalFetched: 0,
      error: error instanceof Error ? error.message : 'Ошибка обновления',
    };
  }
}