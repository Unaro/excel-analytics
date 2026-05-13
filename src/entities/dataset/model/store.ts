'use client';
import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import type { DatasetRow, ColumnStatistics, DatasetEntry } from './types';

const DEBUG = process.env.NODE_ENV === 'development';
const EMPTY_ROWS: DatasetRow[] = [];
const EMPTY_HEADERS: string[] = [];

const indexedDBStorage: StateStorage = {
  getItem: async (name) => (await get(name)) || null,
  setItem: async (name, value) => { if (DEBUG) console.log('[DatasetStore] SET:', name); await set(name, value); },
  removeItem: async (name) => await del(name),
};

interface DatasetState {
  datasets: Record<string, DatasetEntry>;
  activeDatasetId: string | null;
  isSyncing: boolean;

  // Multi-dataset actions
  addDataset: (id: string, entry: Omit<DatasetEntry, 'id' | 'rows' | 'lastAccessedAt'>) => void;
  setDatasetRows: (id: string, rows: DatasetRow[]) => void;
  switchDataset: (id: string) => void;
  unloadDataset: (id: string) => void;
  removeDataset: (id: string) => void;
  setSyncing: (isSyncing: boolean) => void;
  clearAll: () => void;

  // Getters (active-aware + backward compatibility)
  getActiveDataset: () => DatasetEntry | null;
  getAllData: () => DatasetRow[];
  getHeaders: () => string[];
  hasData: () => boolean;
  getColumnStatistics: (columnName: string) => ColumnStatistics | null;
}

export const useDatasetStore = create<DatasetState>()(
  persist(
    (set, get) => ({
      datasets: {},
      activeDatasetId: null,
      isSyncing: false,

      addDataset: (id, entry) => set((state) => ({
        datasets: { 
            ...state.datasets, 
            [id]: { ...entry, id, rows: null, lastAccessedAt: Date.now() } 
        },
        activeDatasetId: state.activeDatasetId ?? id,
      })),

      setDatasetRows: (id, rows) => set((state) => {
        if (!state.datasets[id]) return state;
        return {
          datasets: { ...state.datasets, [id]: { ...state.datasets[id], rows, lastAccessedAt: Date.now() } }
        };
      }),

      switchDataset: (id) => set((state) => {
        if (!state.datasets[id]) return state;
        return {
          activeDatasetId: id,
          datasets: { ...state.datasets, [id]: { ...state.datasets[id], lastAccessedAt: Date.now() } }
        };
      }),

      unloadDataset: (id) => set((state) => {
        if (!state.datasets[id]) return state;
        return { datasets: { ...state.datasets, [id]: { ...state.datasets[id], rows: null } } };
      }),

      removeDataset: (id) => set((state) => {
        const next = { ...state.datasets };
        delete next[id];
        return {
          datasets: next,
          activeDatasetId: state.activeDatasetId === id ? null : state.activeDatasetId,
        };
      }),

      setSyncing: (isSyncing) => set({ isSyncing }),
      clearAll: () => set({ datasets: {}, activeDatasetId: null, isSyncing: false }),

      getActiveDataset: () => {
        const { activeDatasetId, datasets } = get();
        return activeDatasetId ? datasets[activeDatasetId] ?? null : null;
      },

      getAllData: () => get().getActiveDataset()?.rows ?? EMPTY_ROWS,
      
      getHeaders: () => {
        const rows = get().getAllData();
        return rows.length === 0 ? EMPTY_HEADERS : Object.keys(rows[0]);
      },

      hasData: () => get().getAllData().length > 0,

      getColumnStatistics: (columnName) => {
        const allData = get().getAllData();
        if (allData.length === 0) return null;
        const values = allData.map(row => row[columnName]).filter(v => v != null);
        const nums = values.filter(v => typeof v === 'number') as number[];
        const unique = new Set(values);
        const stats: ColumnStatistics = {
          columnName, totalValues: values.length, nullCount: allData.length - values.length,
          uniqueCount: unique.size, numericCount: nums.length, textCount: values.length - nums.length,
          booleanCount: values.filter(v => typeof v === 'boolean').length, dateCount: 0,
          sampleValues: Array.from(unique).slice(0, 5),
        };
        if (nums.length > 0) {
          stats.min = Math.min(...nums); stats.max = Math.max(...nums);
          stats.sum = nums.reduce((a, b) => a + b, 0); stats.avg = stats.sum / nums.length;
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
      partialize: (state) => {
        const persisted: Record<string, any> = {};
        for (const [id, entry] of Object.entries(state.datasets)) {
            persisted[id] = entry; 
        }
        return { datasets: persisted, activeDatasetId: state.activeDatasetId, isSyncing: false };
      },
    }
  )
);