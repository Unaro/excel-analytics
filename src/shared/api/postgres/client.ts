// shared/api/postgres/client.ts
import type { DatasetRow } from '@/shared/lib/types/dataset';
import postgres from 'postgres';

export interface PgConnectionConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
}

function tryParseFloat(val: string): number | null {
  const normalized = val.replace(/\s/g, '').replace(',', '.');
  if (/^-?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(normalized)) {
    const num = Number(normalized);
    return isFinite(num) ? num : null;
  }
  return null;
}

export function normalizePgRow(row: Record<string, unknown>): DatasetRow {
  const normalized: DatasetRow = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined) {
      normalized[key] = null;
    } else if (typeof value === 'number') {
      normalized[key] = isFinite(value) ? value : null;
    } else if (typeof value === 'boolean') {
      normalized[key] = value;
    } else if (typeof value === 'bigint') {
      normalized[key] = Number(value);
    } else if (value instanceof Date) {
      normalized[key] = value.toISOString();
    } else {
      const str = String(value).trim();
      if (str === '') {
        normalized[key] = null;
      } else {
        const num = tryParseFloat(str);
        normalized[key] = num !== null ? num : str;
      }
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
    transform: { undefined: null },
  });
}