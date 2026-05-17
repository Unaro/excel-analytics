'use client';
import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import type { DatasetRow, ColumnStatistics, DatasetEntry } from './types';

const DEBUG = process.env.NODE_ENV === 'development';
const MAX_PERSISTED_ROWS = 50000; // Жесткий лимит для защиты от QuotaExceededError

/**
 * Безопасное IndexedDB хранилище с обработкой квот
 */
const indexedDBStorage: StateStorage = {
  getItem: async (name) => {
    const val = await get(name);
    return val ?? null;
  },
  setItem: async (name, value) => {
    try {
      if (DEBUG) console.log('[DatasetStore] Persisting:', name);
      await set(name, value);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'QuotaExceededError') {
        console.warn('[DatasetStore] Quota exceeded. Stripping rows and retrying...');
        try {
          const parsed = JSON.parse(value);
          if (parsed.state?.datasets) {
            for (const id of Object.keys(parsed.state.datasets)) {
              parsed.state.datasets[id].rows = null;
            }
            await set(name, JSON.stringify(parsed));
          }
        } catch (fallbackErr) {
          console.error('[DatasetStore] Fallback persistence failed:', fallbackErr);
        }
      } else {
        console.error('[DatasetStore] Persistence error:', err);
      }
    }
  },
  removeItem: async (name) => await del(name),
};

interface DatasetState {
  datasets: Record<string, DatasetEntry>;
  activeDatasetId: string | null;
  isSyncing: boolean;
  addDataset: (id: string, entry: Omit<DatasetEntry, 'id' | 'rows' | 'lastAccessedAt'>) => void;
  updateDataset: (id: string, updates: Partial<DatasetEntry>) => void;
  setDatasetRows: (id: string, rows: DatasetRow[]) => void;
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
        return { datasets: { ...state.datasets, [id]: { ...state.datasets[id], rows, lastAccessedAt: Date.now() } } };
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
      getActiveDataset: () => { const { activeDatasetId, datasets } = get(); return activeDatasetId ? datasets[activeDatasetId] ?? null : null; },
      getAllData: () => get().getActiveDataset()?.rows ?? [],
      getHeaders: () => { const rows = get().getAllData(); return rows.length === 0 ? [] : Object.keys(rows[0]); },
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
      setPgStatus: (id, status) => set((s) => {
        if (!s.datasets[id]) return s;
        return { datasets: { ...s.datasets, [id]: { ...s.datasets[id], pgStatus: status } } };
      }),
    }),
    {
      name: 'dataset-storage',
      storage: createJSONStorage(() => indexedDBStorage),
      partialize: (state) => {
        const persisted: Record<string, DatasetEntry> = {};
        for (const [id, entry] of Object.entries(state.datasets)) {
          // Обрезаем до 50k строк (соответствует MAX_SYNC_LIMIT)
          const safeRows = entry.rows && entry.rows.length > MAX_PERSISTED_ROWS
            ? entry.rows.slice(0, MAX_PERSISTED_ROWS)
            : entry.rows;

          persisted[id] = {
            ...entry,
            rows: safeRows,
            pgStatus: 'unknown', // Сбрасываем волатильный статус при перезагрузке
            lastAccessedAt: entry.lastAccessedAt
          };
        }
        return { datasets: persisted, activeDatasetId: state.activeDatasetId, isSyncing: false };
      },
      /**
       * Безопасное слияние: не затираем свежие runtime-данные при гидрации
       */
      merge: (persistedState: unknown, currentState: DatasetState) => {
        const parsed = persistedState as Partial<DatasetState>;
        const mergedDatasets = { ...currentState.datasets };
        
        if (parsed?.datasets) {
          for (const [id, entry] of Object.entries(parsed.datasets)) {
            mergedDatasets[id] = {
              ...entry,
              ...(currentState.datasets[id]?.rows && { rows: currentState.datasets[id].rows })
            };
          }
        }
        
        return { ...currentState, ...parsed, datasets: mergedDatasets };
      }
    }
  )
);