export type DatasetSourceType = 'file' | 'postgres' | null;

/**
 * Универсальная строка датасета
 * Совместима с Excel, PostgreSQL, CSV, API
 */
export interface DatasetRow {
  [columnName: string]: string | number | boolean | null;
}

/**
 * Метаданные загруженного датасета
 */
export interface DatasetMetadata {
  sourceName: string; // Имя файла или schema.table
  uploadedAt: number;
  sheetOrTableNames: string[];
  totalRows: number;
  totalColumns: number;
  sourceType: DatasetSourceType;
}

/**
 * Конфигурация PostgreSQL-подключения (хранится в сторе)
 */
export interface PgSyncConfig {
  schema: string;
  table: string;
  lastSyncAt: number;
  connectionId?: string; // Для будущей серверной авторизации
}

/**
 * Статистика по колонке (для авто-классификации и UI)
 */
export interface ColumnStatistics {
  columnName: string;
  totalValues: number;
  nullCount: number;
  uniqueCount: number;
  numericCount: number;
  textCount: number;
  booleanCount: number;
  dateCount: number;
  sampleValues: (string | number | boolean | null)[];
  min?: number;
  max?: number;
  avg?: number;
  sum?: number;
  median?: number;
}