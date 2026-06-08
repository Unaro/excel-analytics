// shared/lib/types/dataset.ts
// ─────────────────────────────────────────────────────────────
// Универсальные типы данных датасета.
// Используются во всех слоях: computation, storage, api.
// ─────────────────────────────────────────────────────────────

/**
 * Универсальная строка датасета.
 * Значения — только примитивы (без Date, объектов, массивов).
 */
export interface DatasetRow {
  [columnName: string]: string | number | boolean | null;
}

/**
 * Пользовательская классификация колонки.
 */
export type ColumnClassification =
  | 'numeric'
  | 'categorical'
  | 'ignore'
  | 'date';

/**
 * Конфигурация одной колонки (устанавливается пользователем).
 */
export interface ColumnConfig {
  columnName: string;
  classification: ColumnClassification;
  alias: string;
  displayName: string;
  description?: string;
}

/**
 * Статистика по колонке (для авто-классификации и UI).
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