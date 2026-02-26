// lib/stores/metric-template-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import type { MetricTemplate } from '@/types';

interface MetricTemplateState {
  templates: MetricTemplate[];
  
  // Действия
  addTemplate: (template: Omit<MetricTemplate, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateTemplate: (id: string, updates: Partial<Omit<MetricTemplate, 'id' | 'createdAt'>>) => void;
  deleteTemplate: (id: string) => void;
  duplicateTemplate: (id: string) => string | null;
  
  // Геттеры
  getTemplate: (id: string) => MetricTemplate | undefined;
  getAllTemplates: () => MetricTemplate[];
  getTemplatesByType: (type: 'aggregate' | 'calculated') => MetricTemplate[];
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
      
      getTemplatesByType: (type) => {
        return get().templates.filter((template) => template.type === type);
      },
    }),
    {
      name: 'metric-template-storage',
      version: 1,
    }
  )
);
