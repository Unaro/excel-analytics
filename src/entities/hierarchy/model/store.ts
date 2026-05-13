// entities/hierarchy/model/store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { HierarchyLevel, HierarchyConfig } from '@/types';

interface HierarchyState {
  levelsByDataset: Record<string, HierarchyLevel[]>;
  config: HierarchyConfig;
  
  // Действия
  setDatasetLevels: (datasetId: string, levels: HierarchyLevel[]) => void;
  addLevel: (datasetId: string, level: Omit<HierarchyLevel, 'id' | 'order'>) => void;
  updateLevel: (datasetId: string, levelId: string, updates: Partial<HierarchyLevel>) => void;
  deleteLevel: (datasetId: string, levelId: string) => void;
  reorderLevels: (datasetId: string, levels: HierarchyLevel[]) => void;
  clearDatasetLevels: (datasetId: string) => void;
  
  // Геттеры
  getLevels: (datasetId: string) => HierarchyLevel[];
  getLevel: (datasetId: string, id: string) => HierarchyLevel | undefined;
  getLevelByColumn: (datasetId: string, columnName: string) => HierarchyLevel | undefined;
  getMaxDepth: (datasetId: string) => number;
  
  // Конфиг (остается глобальным или тоже можно привязать)
  updateConfig: (config: Partial<HierarchyConfig>) => void;
}

const defaultConfig: HierarchyConfig = {
  levels: [],
  maxDepth: 5,
  allowMultipleSelection: false,
  autoExpandFirstLevel: true,
};

export const useHierarchyStore = create<HierarchyState>()(
  persist(
    (set, get) => ({
      levelsByDataset: {},
      config: defaultConfig,
      
      setDatasetLevels: (datasetId, levels) => 
        set((state) => ({
          levelsByDataset: { ...state.levelsByDataset, [datasetId]: levels }
        })),
      
      addLevel: (datasetId, level) => {
        const id = `level-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const currentLevels = get().getLevels(datasetId);
        const order = currentLevels.length;
        set((state) => ({
          levelsByDataset: {
            ...state.levelsByDataset,
            [datasetId]: [...currentLevels, { ...level, id, order }]
          }
        }));
      },
      
      updateLevel: (datasetId, levelId, updates) => {
        set((state) => {
          const levels = state.levelsByDataset[datasetId] || [];
          return {
            levelsByDataset: {
              ...state.levelsByDataset,
              [datasetId]: levels.map((lvl) =>
                lvl.id === levelId ? { ...lvl, ...updates } : lvl
              )
            }
          };
        });
      },
      
      deleteLevel: (datasetId, levelId) => {
        set((state) => {
          const levels = state.levelsByDataset[datasetId] || [];
          return {
            levelsByDataset: {
              ...state.levelsByDataset,
              [datasetId]: levels
                .filter((lvl) => lvl.id !== levelId)
                .map((lvl, index) => ({ ...lvl, order: index }))
            }
          };
        });
      },
      
      reorderLevels: (datasetId, newLevels) => {
        set((state) => ({
          levelsByDataset: {
            ...state.levelsByDataset,
            [datasetId]: newLevels.map((lvl, index) => ({ ...lvl, order: index }))
          }
        }));
      },
      
      clearDatasetLevels: (datasetId) => {
        set((state) => {
          const next = { ...state.levelsByDataset };
          delete next[datasetId];
          return { levelsByDataset: next };
        });
      },
      
      // Геттеры
      getLevels: (datasetId) => get().levelsByDataset[datasetId] || [],
      getLevel: (datasetId, id) => get().levelsByDataset[datasetId]?.find((lvl) => lvl.id === id),
      getLevelByColumn: (datasetId, columnName) => 
        get().levelsByDataset[datasetId]?.find((lvl) => lvl.columnName === columnName),
      getMaxDepth: (datasetId) => get().levelsByDataset[datasetId]?.length || 0,
      
      updateConfig: (configUpdates) => {
        set((state) => ({
          config: { ...state.config, ...configUpdates }
        }));
      },
    }),
    {
      name: 'hierarchy-storage',
      version: 2, // Инкрементим версию из-за смены структуры
    }
  )
);