import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import type { SheetData, DatasetMetadata, DatasetRow, ColumnStatistics } from './types';

const DEBUG = true;

/**
 * Адаптер Zustand → IndexedDB через idb-keyval
 */
const indexedDBStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (DEBUG) console.log('[IndexedDB] GET:', name);
    return (await get(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (DEBUG) console.log('[IndexedDB] SET:', name, value);
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    if (DEBUG) console.log('[IndexedDB] DELETE:', name);
    await del(name);
  },
};

export type DatasetSourceType = 'file' | 'postgres' | null;

interface DatasetState {
  sourceType: DatasetSourceType;
  data: SheetData[] | null;
  metadata: DatasetMetadata | null;
  isSyncing: boolean;

  // Actions
  setData: (data: SheetData[], metadata: DatasetMetadata, sourceType: DatasetSourceType) => void;
  setSyncing: (isSyncing: boolean) => void;
  clearData: () => void;

  // Getters
  getSheetData: (sheetName: string) => DatasetRow[];
  getAllData: () => DatasetRow[];
  getSheetNames: () => string[];
  getHeaders: (sheetName?: string) => string[];
  hasData: () => boolean;
  getColumnStatistics: (columnName: string) => ColumnStatistics | null;
}

export const useDatasetStore = create<DatasetState>()(
  persist(
    (set, get) => ({
      sourceType: null,
      data: null,
      metadata: null,
      isSyncing: false,

      setData: (data, metadata, sourceType) => 
        set({ data, metadata, sourceType, isSyncing: false }),
      
      setSyncing: (isSyncing) => set({ isSyncing }),
      
      clearData: () => 
        set({ data: null, metadata: null, sourceType: null, isSyncing: false }),

      getSheetData: (sheetName: string) => {
        const data = get().data;
        if (!data) return [];
        const sheet = data.find((s) => s.sheetName === sheetName);
        return sheet?.rows ?? [];
      },

      getAllData: () => {
        const data = get().data;
        if (!data) return [];
        return data.flatMap((sheet) => sheet.rows);
      },

      getSheetNames: () => {
        const data = get().data;
        if (!data) return [];
        return data.map((sheet) => sheet.sheetName);
      },

      getHeaders: (sheetName?: string) => {
        const data = get().data;
        if (!data || data.length === 0) return [];
        if (sheetName) {
          const sheet = data.find((s) => s.sheetName === sheetName);
          return sheet?.headers ?? [];
        }
        return data[0].headers;
      },

      hasData: () => {
        const data = get().data;
        return !!data && data.length > 0;
      },

      getColumnStatistics: (columnName: string) => {
        const allData = get().getAllData();
        if (allData.length === 0) return null;

        const values = allData.map(row => row[columnName]).filter(v => v != null);
        const numericValues = values.filter(v => typeof v === 'number') as number[];
        const uniqueValues = new Set(values);

        const statistics: ColumnStatistics = {
          columnName,
          totalValues: values.length,
          nullCount: allData.length - values.length,
          uniqueCount: uniqueValues.size,
          numericCount: numericValues.length,
          textCount: values.length - numericValues.length,
          booleanCount: values.filter(v => typeof v === 'boolean').length,
          dateCount: 0,
          sampleValues: Array.from(uniqueValues).slice(0, 5),
        };

        if (numericValues.length > 0) {
          statistics.min = Math.min(...numericValues);
          statistics.max = Math.max(...numericValues);
          statistics.sum = numericValues.reduce((a, b) => a + b, 0);
          statistics.avg = statistics.sum / numericValues.length;
          const sorted = [...numericValues].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          statistics.median = sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];
        }

        return statistics;
      },
    }),
    {
      name: 'dataset-storage',
      storage: createJSONStorage(() => indexedDBStorage),
      skipHydration: true,
      partialize: (state) => ({
        sourceType: state.sourceType,
        metadata: state.metadata,
        isSyncing: false,
      }),
    }
  )
);

// Обратная совместимость: все текущие импорты useExcelDataStore продолжат работать
export const useExcelDataStore = useDatasetStore;