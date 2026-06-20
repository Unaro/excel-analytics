// lib/stores/metric-template-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createMigration } from '@/shared/lib/storage/migration';
import { nanoid } from 'nanoid';
import { MetricTemplate } from '@/shared/lib/validators';
import type { ColorConfig } from '@/shared/lib/types/dashboard';

interface MetricTemplateState {
  templates: MetricTemplate[];

  // Действия
  addTemplate: (template: Omit<MetricTemplate, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateTemplate: (id: string, updates: Partial<Omit<MetricTemplate, 'id' | 'createdAt'>>) => void;
  /** Условное форматирование шаблона — единый источник для дашборда и групп. */
  setTemplateColorConfig: (id: string, colorConfig: ColorConfig) => void;
  deleteTemplate: (id: string) => void;
  duplicateTemplate: (id: string) => string | null;
  
  // Геттеры
  getTemplate: (id: string) => MetricTemplate | undefined;
  getAllTemplates: () => MetricTemplate[];
}

export const useMetricTemplateStore = create<MetricTemplateState>()(
  persist(
    (set, get) => ({
      templates: [],
      
      addTemplate: (template) => {
        const id = nanoid();
        const now = Date.now();
        
        set((state) => ({
          templates: [
            ...state.templates,
            {
              ...template,
              id,
              createdAt: now,
              updatedAt: now,
            },
          ],
        }));
        
        return id;
      },
      
      updateTemplate: (id, updates) => {
        set((state) => ({
          templates: state.templates.map((template) =>
            template.id === id
              ? { ...template, ...updates, updatedAt: Date.now() }
              : template
          ),
        }));
      },
      
      setTemplateColorConfig: (id, colorConfig) => {
        set((state) => ({
          templates: state.templates.map((template) =>
            template.id === id
              ? { ...template, colorConfig, updatedAt: Date.now() }
              : template
          ),
        }));
      },

      deleteTemplate: (id) => {
        set((state) => ({
          templates: state.templates.filter((template) => template.id !== id),
        }));
      },
      
      duplicateTemplate: (id) => {
        const template = get().getTemplate(id);
        if (!template) return null;
        
        const newId = nanoid();
        const now = Date.now();
        
        set((state) => ({
          templates: [
            ...state.templates,
            {
              ...template,
              id: newId,
              name: `${template.name} (копия)`,
              createdAt: now,
              updatedAt: now,
            },
          ],
        }));
        
        return newId;
      },
      
      getTemplate: (id) => {
        return get().templates.find((template) => template.id === id);
      },
      
      getAllTemplates: () => {
        return get().templates;
      },
    }),
    {
      name: 'metric-template-storage',
      version: 3,
      migrate: createMigration({
        // v0 (до версионирования) → v1: шаблоны совместимы — переносим как есть.
        1: (state) => state,
        // v1 → v2: prefix/suffix → единое поле unit (приоритет у suffix).
        2: (state) => ({
          ...state,
          templates: ((state.templates as Array<Record<string, unknown>> | undefined) ?? []).map(
            (t) => {
              const { prefix, suffix, ...rest } = t;
              return {
                ...rest,
                unit: t.unit ?? suffix ?? prefix ?? undefined,
              };
            }
          ),
        }),
        // v2 → v3: тип aggregate упразднён — превращаем в формулу FN(field).
        // calculated переносим как есть, убирая поля type/aggregate*.
        3: (state) => ({
          ...state,
          templates: ((state.templates as Array<Record<string, unknown>> | undefined) ?? []).map(
            (t) => {
              const { type, aggregateFunction, aggregateField, ...rest } = t;
              if (type === 'aggregate' && aggregateFunction && aggregateField) {
                // PERCENTILE (без параметра) исторически = медиана (P50);
                // формульный препроцессор знает только MEDIAN.
                const fn = aggregateFunction === 'PERCENTILE' ? 'MEDIAN' : aggregateFunction;
                return { ...rest, formula: `${fn}(${aggregateField})` };
              }
              return rest; // calculated — formula уже есть
            }
          ),
        }),
      }),
    }
  )
);
