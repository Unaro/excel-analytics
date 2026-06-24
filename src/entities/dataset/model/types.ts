// entities/dataset/model/types.ts
import type { DatasetRow, ColumnStatistics } from '@/shared/lib/types/dataset';
import type { AggregateLayoutConfig } from '@/shared/lib/types/aggregate';
import type { ColumnClassification } from '@/shared/lib/types';

export type DatasetSourceType = 'file' | 'postgres' | null;

/**
 * Сериализуемые параметры разбора файла (шаг «Импорт»), сохранённые на
 * датасете, чтобы замена сырого файла шла тем же быстрым путём, что и
 * первичная загрузка. Структурно повторяет `ImportParams` фичи импорта, но
 * живёт в entities (граница FSD — без зависимости от features).
 */
export interface DatasetImportParams {
  /** Разделитель колонок (CSV); null — xlsx. */
  delimiter: string | null;
  /** Десятичный разделитель чисел. */
  decimalSeparator: '.' | ',';
  /** Тип каждой колонки по имени. */
  columnTypes: Record<string, ColumnClassification>;
  /** strptime-формат дат для нативного CSV (необязательно). */
  dateFormat?: string;
}

/**
 * Метаданные загруженного датасета.
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
 * Конфигурация PostgreSQL-подключения.
 */
export interface PgSyncConfig {
  schema: string;
  table: string;
  lastSyncAt: number;
  encryptedConnection?: string;
}

/**
 * Роль датасета:
 *  - 'data' (по умолчанию, поле отсутствует) — обычные данные пользователя;
 *  - 'reference' — служебный справочник (ОКТМО/ОКАТО и т.п.): скрыт из
 *    переключателя датасетов и списков, используется пользовательскими
 *    типами колонок (см. entities/reference-type).
 */
export type DatasetRole = 'data' | 'reference';

/**
 * Запись одного датасета в мульти-хранилище.
 */
export interface DatasetEntry {
  id: string;
  name: string;
  role?: DatasetRole;
  sourceType: DatasetSourceType;
  metadata: DatasetMetadata;
  pgConfig?: PgSyncConfig | null;
  rows: DatasetRow[] | null;
  lastAccessedAt: number;
  pgStatus?: 'online' | 'offline' | 'checking' | 'unknown';
  engineStatus?: 'loading' | 'ready' | 'error';
  /**
   * Разметка файла-агрегата, если датасет импортирован как агрегат. Хранится,
   * чтобы замена файла могла переиспользовать те же настройки чтения и не
   * заставлять пользователя размечать заново.
   */
  aggregateConfig?: AggregateLayoutConfig;
  /**
   * Параметры разбора сырого файла (delimiter/типы/формат дат). Хранятся, чтобы
   * замена файла шла тем же нативным CSV-путём, что и первичный импорт, а не
   * откатывалась на медленный авто-разбор. Для агрегатов не нужны — там разбор
   * выводится из `aggregateConfig`.
   */
  importParams?: DatasetImportParams;
}

/**
 * Тип данных колонки (авто-определяемый системой).
 */
export type ColumnDataType =
  | 'numeric'
  | 'categorical'
  | 'text'
  | 'date'
  | 'boolean'
  | 'mixed';

export interface ReplaceFileResult {
  success: boolean;
  error?: string;
  addedColumns?: string[];
  removedColumns?: string[];
}

export interface DatasetState {
  datasets: Record<string, DatasetEntry>;
  activeDatasetId: string | null;
  isSyncing: boolean;
  addDataset: (id: string, entry: Omit<DatasetEntry, 'id' | 'rows' | 'lastAccessedAt'>) => void;
  updateDataset: (id: string, updates: Partial<DatasetEntry>) => void;
  setDatasetRows: (id: string, rows: DatasetRow[] | null) => void;
  switchDataset: (id: string) => void;
  unloadDataset: (id: string) => void;
  removeDataset: (id: string) => void;
  setSyncing: (isSyncing: boolean) => void;
  clearAll: () => void;
  getActiveDataset: () => DatasetEntry | null;
  getAllData: () => DatasetRow[];
  getHeaders: () => string[];
  hasData: () => boolean;
  getColumnStatistics: (columnName: string) => ColumnStatistics | null;
  setPgStatus: (id: string, status: 'online' | 'offline' | 'checking' | 'unknown') => void;
}