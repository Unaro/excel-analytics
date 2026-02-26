// lib/stores/column-config-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ColumnConfig, ColumnClassification } from '@/types';

interface ColumnConfigState {
  configs: ColumnConfig[];
  
  // Действия
  setConfigs: (configs: ColumnConfig[]) => void;
  updateColumn: (columnName: string, updates: Partial<ColumnConfig>) => void;
  updateMultiple: (updates: { columnName: string; data: Partial<ColumnConfig> }[]) => void;
  deleteColumn: (columnName: string) => void;
  restoreDefaults: (columns: string[]) => void;
  clear: () => void;
  
  // Геттеры
  getConfig: (columnName: string) => ColumnConfig | undefined;
  getConfigsByClassification: (classification: ColumnClassification) => ColumnConfig[];
  getCategoricalColumns: () => ColumnConfig[];
  getNumericColumns: () => ColumnConfig[];
}

export const useColumnConfigStore = create<ColumnConfigState>()(
  persist(
    (set, get) => ({
      configs: [],
      
      setConfigs: (configs) => set({ configs }),
      
      updateColumn: (columnName, updates) => {
        set((state) => ({
          configs: state.configs.map((col) =>
            col.columnName === columnName ? { ...col, ...updates } : col
          ),
        }));
      },
      
      updateMultiple: (updates) => {
        set((state) => ({
          configs: state.configs.map((col) => {
            const update = updates.find((u) => u.columnName === col.columnName);
            return update ? { ...col, ...update.data } : col;
          }),
        }));
      },
      
      deleteColumn: (columnName) => {
        set((state) => ({
          configs: state.configs.filter((col) => col.columnName !== columnName),
        }));
      },
      
      restoreDefaults: (columns) => {
        set({
          configs: columns.map((col) => ({
            columnName: col,
            classification: 'ignore',
            alias: col.toLowerCase().replace(/\W+/g, '_'),
            displayName: col,
          })),
        });
      },
      
      clear: () => set({ configs: [] }),
      
      getConfig: (columnName) => {
        return get().configs.find((col) => col.columnName === columnName);
      },
      
      getConfigsByClassification: (classification) => {
        return get().configs.filter((col) => col.classification === classification);
      },
      
      getCategoricalColumns: () => {
        return get().getConfigsByClassification('categorical');
      },
      
      getNumericColumns: () => {
        return get().getConfigsByClassification('numeric');
      },
    }),
    {
      name: 'column-config-storage',
      version: 1,
    }
  )
);
