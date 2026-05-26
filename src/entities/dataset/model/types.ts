export type DatasetSourceType = 'file' | 'postgres' | null;

/**
 * Универсальная строка датасета
 */
export interface DatasetRow {
  [columnName: string]: string | number | boolean | null;
}

/**
 * Метаданные загруженного датасета
 */
export interface DatasetMetadata {
  sourceName: string;
  uploadedAt: number;
  sheetOrTableNames: string[];
  totalRows: number;
  totalColumns: number;
  sourceType: DatasetSourceType;
}

/**
 * Конфигурация PostgreSQL-подключения
 */
export interface PgSyncConfig {
  schema: string;
  table: string;
  lastSyncAt: number;
  encryptedConnection?: string;
}

/**
 * Запись одного датасета в мульти-хранилище
 */
export interface DatasetEntry {
  id: string;
  name: string;
  sourceType: DatasetSourceType;
  metadata: DatasetMetadata;
  pgConfig?: PgSyncConfig | null;
  rows: DatasetRow[] | null;
  lastAccessedAt: number;
  pgStatus?: 'online' | 'offline' | 'checking' | 'unknown';
  engineStatus?: 'loading' | 'ready' | 'error';
}

/**
 * Статистика по колонке
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

/**
 * Тип данных колонки (авто-определяемый системой)
 */
export type ColumnDataType = 
  | 'numeric'      // Числовые данные (можно суммировать, агрегировать)
  | 'categorical'  // Категориальные данные (для группировки, фильтрации)
  | 'text'         // Текстовые данные (описания, комментарии)
  | 'date'         // Даты
  | 'boolean'      // Логические значения
  | 'mixed';       // Смешанный тип

/**
 * Пользовательская классификация колонки
 */
export type ColumnClassification = 
  | 'numeric'      // Использовать для вычислений
  | 'categorical'  // Использовать для группировки
  | 'ignore'      // Игнорировать колонку
  | 'date';      // Использовать как дату

/**
 * Конфигурация одной колонки (устанавливается пользователем)
 */
export interface ColumnConfig {
  columnName: string;                    // Оригинальное название из Excel
  classification: ColumnClassification;  // Как использовать колонку
  alias: string;                         // Алиас для использования в формулах
  displayName: string;                   // Название для отображения в UI
  description?: string;                  // Описание колонки
}
