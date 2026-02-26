// lib/stores/indicator-group-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import type {
  IndicatorGroup,
  FieldBinding,
  GroupMetric,
} from '@/types';

interface IndicatorGroupState {
  groups: IndicatorGroup[];
  
  // --- Основные действия с группами ---
  addGroup: (group: Omit<IndicatorGroup, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateGroup: (id: string, updates: Partial<Omit<IndicatorGroup, 'id' | 'createdAt'>>) => void;
  deleteGroup: (id: string) => void;
  duplicateGroup: (id: string) => string | null;
  
  // --- Действия с FieldMappings (Привязка полей Excel) ---
  addFieldMapping: (groupId: string, mapping: Omit<FieldBinding, 'id'>) => void;
  updateFieldMapping: (groupId: string, mappingId: string, updates: Partial<FieldBinding>) => void;
  deleteFieldMapping: (groupId: string, mappingId: string) => void;
  
  // --- Действия с Метриками внутри группы ---
  addMetric: (groupId: string, metric: Omit<GroupMetric, 'id'>) => string;
  updateMetric: (groupId: string, metricId: string, updates: Partial<GroupMetric>) => void;
  deleteMetric: (groupId: string, metricId: string) => void;
  reorderMetrics: (groupId: string, metricIds: string[]) => void;
  
  // --- Геттеры ---
  getGroup: (id: string) => IndicatorGroup | undefined;
  getAllGroups: () => IndicatorGroup[];
}

export const useIndicatorGroupStore = create<IndicatorGroupState>()(
  persist(
    (set, get) => ({
      groups: [],
      
      // --- Группы ---
      
      addGroup: (group) => {
        const id = nanoid();
        const now = Date.now();
        
        set((state) => ({
          groups: [
            ...state.groups,
            {
              ...group,
              id,
              createdAt: now,
              updatedAt: now,
              // virtualMetricBindings здесь больше нет!
            },
          ],
        }));
        
        return id;
      },
      
      updateGroup: (id, updates) => {
        set((state) => ({
          groups: state.groups.map((group) =>
            group.id === id
              ? { ...group, ...updates, updatedAt: Date.now() }
              : group
          ),
        }));
      },
      
      deleteGroup: (id) => {
        set((state) => ({
          groups: state.groups.filter((group) => group.id !== id),
        }));
      },
      
      duplicateGroup: (id) => {
        const group = get().getGroup(id);
        if (!group) return null;
        
        const newId = nanoid();
        const now = Date.now();
        
        // Генерируем новые ID для всех вложенных сущностей, чтобы это была полная независимая копия
        const newMetrics = group.metrics.map((metric) => ({
          ...metric,
          id: nanoid(),
          // Обновляем ID привязок полей и метрик внутри метрики
          fieldBindings: metric.fieldBindings.map((fb) => ({ ...fb, id: nanoid() })),
          metricBindings: metric.metricBindings.map((mb) => ({ ...mb, id: nanoid() })),
        }));
        
        set((state) => ({
          groups: [
            ...state.groups,
            {
              ...group,
              id: newId,
              name: `${group.name} (копия)`,
              fieldMappings: group.fieldMappings.map((fm) => ({ ...fm, id: nanoid() })),
              metrics: newMetrics,
              // virtualMetricBindings копировать не нужно, их больше нет в определении
              createdAt: now,
              updatedAt: now,
            },
          ],
        }));
        
        return newId;
      },
      
      // --- FieldMappings ---
      
      addFieldMapping: (groupId, mapping) => {
        const id = nanoid();
        set((state) => ({
          groups: state.groups.map((group) =>
            group.id === groupId
              ? {
                  ...group,
                  fieldMappings: [...group.fieldMappings, { ...mapping, id }],
                  updatedAt: Date.now(),
                }
              : group
          ),
        }));
      },
      
      updateFieldMapping: (groupId, mappingId, updates) => {
        set((state) => ({
          groups: state.groups.map((group) =>
            group.id === groupId
              ? {
                  ...group,
                  fieldMappings: group.fieldMappings.map((fm) =>
                    fm.id === mappingId ? { ...fm, ...updates } : fm
                  ),
                  updatedAt: Date.now(),
                }
              : group
          ),
        }));
      },
      
      deleteFieldMapping: (groupId, mappingId) => {
        set((state) => ({
          groups: state.groups.map((group) =>
            group.id === groupId
              ? {
                  ...group,
                  fieldMappings: group.fieldMappings.filter((fm) => fm.id !== mappingId),
                  updatedAt: Date.now(),
                }
              : group
          ),
        }));
      },
      
      // --- Metrics ---
      
      addMetric: (groupId, metric) => {
        const id = nanoid();
        set((state) => ({
          groups: state.groups.map((group) =>
            group.id === groupId
              ? {
                  ...group,
                  metrics: [...group.metrics, { ...metric, id }],
                  updatedAt: Date.now(),
                }
              : group
          ),
        }));
        return id;
      },
      
      updateMetric: (groupId, metricId, updates) => {
        set((state) => ({
          groups: state.groups.map((group) =>
            group.id === groupId
              ? {
                  ...group,
                  metrics: group.metrics.map((metric) =>
                    metric.id === metricId ? { ...metric, ...updates } : metric
                  ),
                  updatedAt: Date.now(),
                }
              : group
          ),
        }));
      },
      
      deleteMetric: (groupId, metricId) => {
        set((state) => ({
          groups: state.groups.map((group) =>
            group.id === groupId
              ? {
                  ...group,
                  metrics: group.metrics.filter((metric) => metric.id !== metricId),
                  updatedAt: Date.now(),
                }
              : group
          ),
        }));
      },
      
      reorderMetrics: (groupId, metricIds) => {
        set((state) => ({
          groups: state.groups.map((group) => {
            if (group.id !== groupId) return group;
            
            const reordered = metricIds
              .map((id, index) => {
                const metric = group.metrics.find((m) => m.id === id);
                return metric ? { ...metric, order: index } : null;
              })
              .filter((metric): metric is GroupMetric => metric !== null);
            
            return {
              ...group,
              metrics: reordered,
              updatedAt: Date.now(),
            };
          }),
        }));
      },
      
      // --- Getters ---
      
      getGroup: (id) => {
        return get().groups.find((group) => group.id === id);
      },
      
      getAllGroups: () => {
        return get().groups;
      },
    }),
    {
      name: 'indicator-group-storage',
      version: 2, // Увеличили версию, так как схема данных изменилась (убрали virtualMetricBindings)
    }
  )
);