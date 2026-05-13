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

/**
 * Нормализация строки из PostgreSQL в формат ExcelRow
 * Гарантирует совместимость с текущим вычислительным ядром
 */
export function normalizePgRow(row: Record<string, unknown>): DatasetRow {
  const normalized: DatasetRow = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined) {
      normalized[key] = null;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      normalized[key] = value;
    } else if (typeof value === 'bigint') {
      // BigInt → Number (безопасно для аналитики до 9e15)
      normalized[key] = Number(value);
    } else if (value instanceof Date) {
      normalized[key] = value.toISOString();
    } else {
      const str = String(value).trim();
      normalized[key] = str === '' ? null : str;
    }
  }
  return normalized;
}

/**
 * Создание клиента с жёсткими ограничениями безопасности
 */
export function createPgClient(config: PgConnectionConfig) {
  return postgres({
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.user,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    max: 1, // Server Actions короткоживущие, 1 соединение достаточно
    idle_timeout: 5,
    connect_timeout: 10,
    timeout: 15, // Авто-отмена запросов > 15 сек
    onnotice: () => {}, // Игнорируем NOTICE от БД
  });
}