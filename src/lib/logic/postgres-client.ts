import postgres from 'postgres';
import type { DatasetRow } from '@/types';

export interface PgConnectionConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
}

export function normalizePgRow(row: Record<string, unknown>): DatasetRow {
  const normalized: DatasetRow = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined) normalized[key] = null;
    else if (typeof value === 'number' || typeof value === 'boolean') normalized[key] = value;
    else if (typeof value === 'bigint') normalized[key] = Number(value);
    else if (value instanceof Date) normalized[key] = value.toISOString();
    else {
      const str = String(value).trim();
      normalized[key] = str === '' ? null : str;
    }
  }
  return normalized;
}

export function createPgClient(config: PgConnectionConfig) {
  return postgres({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    max: 1,
    idle_timeout: 2,
    connect_timeout: 20,
    timeout: 10,
    onnotice: () => {},
    transform: { undefined: null }
  });
}