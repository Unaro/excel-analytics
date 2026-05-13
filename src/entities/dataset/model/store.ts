'use client';
import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import type { DatasetRow, DatasetMetadata, DatasetSourceType, PgSyncConfig, ColumnStatistics } from './types';

const DEBUG = true;
const EMPTY_ROWS: DatasetRow[] = [];
const EMPTY_HEADERS: string[] = [];

const indexedDBStorage: StateStorage = {
  getItem: async (name) => (await get(name)) || null,
  setItem: async (name, value) => { if (DEBUG) console.log('[DatasetStore] SET:', name); await set(name, value); },
  removeItem: async (name) => await del(name),
};

interface DatasetState {
  sourceType: DatasetSourceType;
  data: DatasetRow[] | null;
  metadata: DatasetMetadata | null;
  pgConfig: PgSyncConfig | null;
  isSyncing: boolean;

  // Actions
  setData: (data: DatasetRow[], metadata: DatasetMetadata, pgConfig?: PgSyncConfig) => void;
  setSyncing: (isSyncing: boolean) => void;
  clearData: () => void;

  // Getters
  getAllData: () => DatasetRow[];
  getHeaders: () => string[];
  hasData: () => boolean;
  getColumnStatistics: (columnName: string) => ColumnStatistics | null;
}

export const useDatasetStore = create<DatasetState>()(
  persist(
    (set, get) => ({
      sourceType: null,
      data: null,
      metadata: null,
      pgConfig: null,
      isSyncing: false,

      setData: (data, metadata, pgConfig) => 
        set({ data, metadata, sourceType: metadata.sourceType, pgConfig: pgConfig ?? null, isSyncing: false }),
      
      setSyncing: (isSyncing) => set({ isSyncing }),
      
      clearData: () => 
        set({ data: null, metadata: null, sourceType: null, pgConfig: null, isSyncing: false }),

      getAllData: () => get().data ?? EMPTY_ROWS,
      
      getHeaders: () => {
        const data = get().data;
        if (!data || data.length === 0) return EMPTY_HEADERS;
        return Object.keys(data[0]);
        },

      hasData: () => {
        const data = get().data;
        return !!data && data.length > 0;
      },

      getColumnStatistics: (columnName) => {
        const allData = get().getAllData();
        if (allData.length === 0) return null;

        const values = allData.map(row => row[columnName]).filter(v => v != null);
        const nums = values.filter(v => typeof v === 'number') as number[];
        const unique = new Set(values);

        const stats: ColumnStatistics = {
          columnName,
          totalValues: values.length,
          nullCount: allData.length - values.length,
          uniqueCount: unique.size,
          numericCount: nums.length,
          textCount: values.length - nums.length,
          booleanCount: values.filter(v => typeof v === 'boolean').length,
          dateCount: 0,
          sampleValues: Array.from(unique).slice(0, 5),
        };

        if (nums.length > 0) {
          stats.min = Math.min(...nums);
          stats.max = Math.max(...nums);
          stats.sum = nums.reduce((a, b) => a + b, 0);
          stats.avg = stats.sum / nums.length;
          const sorted = [...nums].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          stats.median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
        }

        return stats;
      },
    }),
    {
    name: 'dataset-storage',
    storage: createJSONStorage(() => indexedDBStorage),
    skipHydration: true,
    partialize: (state) => ({
        sourceType: state.sourceType,
        metadata: state.metadata,
        pgConfig: state.pgConfig,
        data: state.data, // ← Ключевое исправление
        isSyncing: false, // Сбрасываем флаг, чтобы при F5 не показывался вечный спиннер
    }),
    }
  )
);

// Обратная совместимость: все текущие импорты продолжат работать
export const useExcelDataStore = useDatasetStore;