// entities/dataset/model/types.ts
import type { DatasetRow, ColumnStatistics } from '@/shared/lib/types/dataset';

export type DatasetSourceType = 'file' | 'postgres' | null;

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
 * Запись одного датасета в мульти-хранилище.
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