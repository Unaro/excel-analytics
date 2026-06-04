'use client';
import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import type { DatasetRow, ColumnStatistics, DatasetEntry, DatasetState } from './types';

const EMPTY_ROWS: DatasetRow[] = [];
const EMPTY_HEADERS: string[] = [];

const idbStorage: StateStorage = {
  getItem: async (name) => (await get(name)) ?? null,
  setItem: async (name, value) => await set(name, value),
  removeItem: async (name) => await del(name),
};

export const useDatasetStore = create<DatasetState>()(
  persist(
    (set, get) => ({
      datasets: {},
      activeDatasetId: null,
      isSyncing: false,
      
      addDataset: (id, entry) => set((state) => ({
        datasets: { ...state.datasets, [id]: { ...entry, id, rows: null, lastAccessedAt: Date.now() } },
        activeDatasetId: state.activeDatasetId ?? id,
      })),
      
      updateDataset: (id, updates) => set((state) => {
        if (!state.datasets[id]) return state;
        return {
          datasets: {
            ...state.datasets,
            [id]: { ...state.datasets[id], ...updates, lastAccessedAt: Date.now() }
          }
        };
      }),
      
      setDatasetRows: (id, rows) => set((state) => {
        if (!state.datasets[id]) return state;
        return { 
          datasets: { 
            ...state.datasets, 
            [id]: { ...state.datasets[id], rows, lastAccessedAt: Date.now() } 
          } 
        };
      }),
      
      switchDataset: (id) => set((state) => {
        if (!state.datasets[id]) return state;
        return { activeDatasetId: id, datasets: { ...state.datasets, [id]: { ...state.datasets[id], lastAccessedAt: Date.now() } } };
      }),
      
      unloadDataset: (id) => set((state) => {
        if (!state.datasets[id]) return state;
        return { datasets: { ...state.datasets, [id]: { ...state.datasets[id], rows: null } } };
      }),
      
      removeDataset: (id) => set((state) => {
        const next = { ...state.datasets };
        delete next[id];
        return { datasets: next, activeDatasetId: state.activeDatasetId === id ? null : state.activeDatasetId };
      }),
      
      setSyncing: (isSyncing) => set({ isSyncing }),
      clearAll: () => set({ datasets: {}, activeDatasetId: null, isSyncing: false }),
      
      getActiveDataset: () => { 
        const { activeDatasetId, datasets } = get();
        return activeDatasetId ? datasets[activeDatasetId] ?? null : null; 
      },
      
      getAllData: () => {
        const ds = get().getActiveDataset();
        return ds?.rows ?? EMPTY_ROWS;
      },
      
      getHeaders: () => {
        const rows = get().getAllData();
        if (rows.length === 0) return EMPTY_HEADERS;
        return Object.keys(rows[0]);
      },
      
      hasData: () => {
        const ds = get().getActiveDataset();
        if (ds?.sourceType === 'file') {
          return ds.engineStatus === 'ready';
        }
        return (ds?.rows?.length ?? 0) > 0;
      },
      
  getColumnStatistics: (columnName) => {
    const allData = get().getAllData();
    if (allData.length === 0 || allData === EMPTY_ROWS) return null;

    const values = allData.map(row => row[columnName]).filter(v => v != null);
    if (values.length === 0) return null;

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
      stats.median = sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
    }
    return stats;
  },
      
      setPgStatus: (id, status) => set((s) => {
        if (!s.datasets[id]) return s;
        return { datasets: { ...s.datasets, [id]: { ...s.datasets[id], pgStatus: status } } };
      }),
    }),
    {
      name: 'dataset-storage',
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => {
        const persisted: Record<string, DatasetEntry> = {};
        for (const [id, entry] of Object.entries(state.datasets)) {
          persisted[id] = {
            ...entry,
            rows: null,
            pgStatus: 'unknown',      
            engineStatus: undefined,
            lastAccessedAt: entry.lastAccessedAt
          };
        }
        return { datasets: persisted, activeDatasetId: state.activeDatasetId, isSyncing: false };
      },
      merge: (persistedState: unknown, currentState: DatasetState) => {
        const parsed = persistedState as Partial<DatasetState>;
        const mergedDatasets = { ...currentState.datasets };
        if (parsed?.datasets) {
          for (const [id, entry] of Object.entries(parsed.datasets)) {
            const currentRows = currentState.datasets[id]?.rows;
            mergedDatasets[id] = {
              ...entry,
              ...(currentRows && currentRows.length > 0 && { rows: currentRows })
            };
          }
        }
        return { ...currentState, ...parsed, datasets: mergedDatasets };
      }
    }
  )
);