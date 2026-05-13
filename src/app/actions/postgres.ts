'use server';
import { z } from 'zod';
import { createPgClient, normalizePgRow, type PgConnectionConfig } from '@/lib/logic/postgres-client';
import type { DatasetRow } from '@/types';

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

/**
 * Тест подключения к БД
 */
export async function testPgConnection(rawConfig: unknown): Promise<{ success: boolean; error?: string }> {
  try {
    const config = validateConfig(rawConfig);
    const sql = createPgClient(config);
    await sql`SELECT 1`;
    await sql.end();
    return { success: true };
  } catch (error) {
    console.error('[PG] Connection test failed:', error);
    const msg = error instanceof Error ? error.message : 'Не удалось подключиться';
    return { success: false, error: msg };
  }
}

/**
 * Чтение схемы: списки таблиц и колонок с типами
 */
export async function getPgSchema(rawConfig: unknown) {
  try {
    const config = validateConfig(rawConfig);
    const sql = createPgClient(config);

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

    await sql.end();

    // Группируем колонки по таблицам
    const schemaMap = new Map<string, Map<string, { name: string; type: string }[]>>();
    for (const col of columns) {
      if (!schemaMap.has(col.table_schema)) schemaMap.set(col.table_schema, new Map());
      const tableMap = schemaMap.get(col.table_schema)!;
      if (!tableMap.has(col.table_name)) tableMap.set(col.table_name, []);
      tableMap.get(col.table_name)!.push({ name: col.column_name, type: col.data_type });
    }

    return {
      success: true,
      tables: tables.map(t => ({
        schema: t.table_schema,
        table: t.table_name,
        columns: schemaMap.get(t.table_schema)?.get(t.table_name) || []
      }))
    };
  } catch (error) {
    console.error('[PG] Schema fetch failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Ошибка чтения схемы' };
  }
}

/**
 * Загрузка данных из таблицы с нормализацией в ExcelRow[]
 */
export async function fetchPgTableData(
  rawConfig: unknown,
  schema: string,
  table: string,
  limit: number = MAX_PREVIEW_LIMIT
): Promise<{ success: boolean; rows: DatasetRow[]; columns: string[]; totalFetched: number; error?: string }> {
  try {
    const config = validateConfig(rawConfig);
    const safeLimit = Math.min(Math.max(1, limit), MAX_SYNC_LIMIT);
    const sql = createPgClient(config);

    // Безопасная подстановка идентификаторов (экранирование имён)
    const rows = await sql`SELECT * FROM ${sql(schema)}.${sql(table)} LIMIT ${safeLimit}`;
    await sql.end();

    if (!Array.isArray(rows) || rows.length === 0) {
      return { success: true, rows: [], columns: [], totalFetched: 0 };
    }

    const columns = Object.keys(rows[0]);
    const normalizedRows = rows.map(normalizePgRow);

    return {
      success: true,
      rows: normalizedRows,
      columns,
      totalFetched: normalizedRows.length
    };
  } catch (error) {
    console.error('[PG] Data fetch failed:', error);
    return { success: false, rows: [], columns: [], totalFetched: 0, error: error instanceof Error ? error.message : 'Ошибка загрузки данных' };
  }
}