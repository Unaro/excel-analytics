// lib/stores/column-config-store.ts
import { ColumnClassification, ColumnConfig } from '@/entities/dataset';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ColumnConfigState {
  configsByDataset: Record<string, ColumnConfig[]>;
  
  // Действия
  setDatasetConfigs: (datasetId: string, configs: ColumnConfig[]) => void;
  updateColumn: (datasetId: string, columnName: string, updates: Partial<ColumnConfig>) => void;
  updateMultiple: (datasetId: string, updates: { columnName: string; data: Partial<ColumnConfig> }[]) => void;
  deleteColumn: (datasetId: string, columnName: string) => void;
  clearDatasetConfigs: (datasetId: string) => void;
  
  // Геттеры
  getConfigs: (datasetId: string) => ColumnConfig[];
  getConfig: (datasetId: string, columnName: string) => ColumnConfig | undefined;
  getConfigsByClassification: (datasetId: string, classification: ColumnClassification) => ColumnConfig[];
  getCategoricalColumns: (datasetId: string) => ColumnConfig[];
  getNumericColumns: (datasetId: string) => ColumnConfig[];
}

export const useColumnConfigStore = create<ColumnConfigState>()(
  persist(
    (set, get) => ({
      configsByDataset: {},
      
      setDatasetConfigs: (datasetId, configs) => 
        set((state) => ({
          configsByDataset: { ...state.configsByDataset, [datasetId]: configs }
        })),
        
      updateColumn: (datasetId, columnName, updates) => {
        set((state) => {
          const currentConfigs = state.configsByDataset[datasetId] || [];
          const updated = currentConfigs.map((col) =>
            col.columnName === columnName ? { ...col, ...updates } : col
          );
          return { configsByDataset: { ...state.configsByDataset, [datasetId]: updated } };
        });
      },
      
      updateMultiple: (datasetId, updates) => {
        set((state) => {
          const currentConfigs = state.configsByDataset[datasetId] || [];
          const updated = currentConfigs.map((col) => {
            const update = updates.find((u) => u.columnName === col.columnName);
            return update ? { ...col, ...update.data } : col;
          });
          return { configsByDataset: { ...state.configsByDataset, [datasetId]: updated } };
        });
      },
      
      deleteColumn: (datasetId, columnName) => {
        set((state) => {
          const currentConfigs = state.configsByDataset[datasetId] || [];
          return { configsByDataset: { ...state.configsByDataset, [datasetId]: currentConfigs.filter((col) => col.columnName !== columnName) } };
        });
      },

      clearDatasetConfigs: (datasetId) => {
        set((state) => {
          const next = { ...state.configsByDataset };
          delete next[datasetId];
          return { configsByDataset: next };
        });
      },
      
      getConfigs: (datasetId) => get().configsByDataset[datasetId] || [],
      getConfig: (datasetId, columnName) => get().configsByDataset[datasetId]?.find((col) => col.columnName === columnName),
      getConfigsByClassification: (datasetId, classification) => get().configsByDataset[datasetId]?.filter((col) => col.classification === classification) || [],
      getCategoricalColumns: (datasetId) => get().getConfigsByClassification(datasetId, 'categorical'),
      getNumericColumns: (datasetId) => get().getConfigsByClassification(datasetId, 'numeric'),
    }),
    {
      name: 'column-config-storage',
      version: 2,
    }
  )
);