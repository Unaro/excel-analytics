// lib/stores/hierarchy-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { HierarchyLevel, HierarchyConfig } from '@/types';

interface HierarchyState {
  levels: HierarchyLevel[];
  config: HierarchyConfig;
  
  // Действия с уровнями
  addLevel: (level: Omit<HierarchyLevel, 'id' | 'order'>) => void;
  updateLevel: (id: string, updates: Partial<HierarchyLevel>) => void;
  deleteLevel: (id: string) => void;
  reorderLevels: (levelIds: HierarchyLevel[]) => void;
  setLevels: (levels: HierarchyLevel[]) => void;
  clear: () => void;
  
  // Действия с конфигурацией
  updateConfig: (config: Partial<HierarchyConfig>) => void;
  
  // Геттеры
  getLevel: (id: string) => HierarchyLevel | undefined;
  getLevelByColumn: (columnName: string) => HierarchyLevel | undefined;
  getMaxDepth: () => number;
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
      levels: [],
      config: defaultConfig,
      
      addLevel: (level) => {
        const id = `level-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const order = get().levels.length;
        
        set((state) => ({
          levels: [...state.levels, { ...level, id, order }],
        }));
      },
      
      updateLevel: (id, updates) => {
        set((state) => ({
          levels: state.levels.map((level) =>
            level.id === id ? { ...level, ...updates } : level
          ),
        }));
      },
      
      deleteLevel: (id) => {
        set((state) => ({
          levels: state.levels
            .filter((level) => level.id !== id)
            .map((level, index) => ({ ...level, order: index })),
        }));
      },
      
      reorderLevels: (newLevels) => {
        set(() => ({
          levels: newLevels.map((level, index) => ({
            ...level,
            order: index
          }))
        }));
      },
      
      setLevels: (levels) => set({ levels }),
      
      clear: () => set({ levels: [], config: defaultConfig }),
      
      updateConfig: (configUpdates) => {
        set((state) => ({
          config: { ...state.config, ...configUpdates },
        }));
      },
      
      getLevel: (id) => {
        return get().levels.find((level) => level.id === id);
      },
      
      getLevelByColumn: (columnName) => {
        return get().levels.find((level) => level.columnName === columnName);
      },
      
      getMaxDepth: () => {
        return get().levels.length;
      },

    }),
    {
      name: 'hierarchy-storage',
      version: 1,
    }
  )
);
