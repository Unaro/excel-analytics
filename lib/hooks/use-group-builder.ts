'use client';

import { useState, useCallback, useEffect } from 'react';
import { useIndicatorGroupStore } from '@/lib/stores/indicator-group-store';
import { useMetricTemplateStore } from '@/lib/stores/metric-template-store';
import { useColumnConfigStore } from '@/lib/stores/column-config-store';
import { FieldBinding, GroupMetric, MetricBinding } from '@/types';
import { nanoid } from 'nanoid';
import { extractVariables } from '@/lib/utils/formula';

export interface FormMetricState {
  templateId: string;
  tempId: string;
  originalMetricId?: string;
  requiredVariables: string[]; 
  variableTypes: Record<string, 'field' | 'metric'>;
  bindings: Record<string, string>; 
}

export function useGroupBuilder(existingGroupId?: string) {
  const { addGroup, updateGroup, getGroup } = useIndicatorGroupStore();
  const templates = useMetricTemplateStore((s) => s.templates);
  const columns = useColumnConfigStore((s) => s.configs);

  const [name, setName] = useState('');
  const [selectedMetrics, setSelectedMetrics] = useState<FormMetricState[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // --- ЗАГРУЗКА СУЩЕСТВУЮЩЕЙ ГРУППЫ ---
  useEffect(() => {
    if (existingGroupId && !isInitialized) {
      const group = getGroup(existingGroupId);
      if (group) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setName((prev) => (prev !== group.name ? group.name : prev));
        
        // 1. Сначала восстанавливаем структуру, генерируя tempId
        const restoredMetrics: FormMetricState[] = group.metrics.map(m => {
          const template = templates.find(t => t.id === m.templateId);
          const requiredVars = template?.formula 
            ? extractVariables(template.formula) 
            : (template?.aggregateField ? [template.aggregateField] : []);
          
          const bindings: Record<string, string> = {};
          const variableTypes: Record<string, 'field' | 'metric'> = {};

          m.fieldBindings.forEach(fb => {
            bindings[fb.fieldAlias] = fb.columnName;
            variableTypes[fb.fieldAlias] = 'field';
          });
          
          m.metricBindings.forEach(mb => {
             // Пока сохраняем "сырой" ID из базы
             bindings[mb.metricAlias] = mb.metricId;
             variableTypes[mb.metricAlias] = 'metric';
          });

          return {
            templateId: m.templateId,
            tempId: nanoid(), // Генерируем новый tempId
            originalMetricId: m.id, // Запоминаем старый ID
            requiredVariables: requiredVars,
            variableTypes,
            bindings
          };
        });

        // 2. ИСПРАВЛЕНИЕ БАГА: Маппинг Real ID -> Temp ID
        // Нам нужно заменить originalMetricId в bindings на соответствующие tempId
        
        // Создаем карту: какой старый ID какому новому соответствует
        const idMap = new Map<string, string>();
        restoredMetrics.forEach(m => {
          if (m.originalMetricId) {
            idMap.set(m.originalMetricId, m.tempId);
          }
        });

        // Проходимся и подменяем ID в bindings
        const fixedMetrics = restoredMetrics.map(m => {
          const newBindings = { ...m.bindings };
          
          Object.keys(newBindings).forEach(alias => {
            // Если это привязка к метрике
            if (m.variableTypes[alias] === 'metric') {
              const oldId = newBindings[alias];
              // Если мы нашли этот старый ID в нашей карте - меняем на tempId
              if (idMap.has(oldId)) {
                newBindings[alias] = idMap.get(oldId)!;
              }
            }
          });

          return { ...m, bindings: newBindings };
        });

        setSelectedMetrics(fixedMetrics);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsInitialized(true);
      }
    }
  }, [existingGroupId, getGroup, isInitialized, templates]);
  
  const addMetricToGroup = useCallback((templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    let requiredVariables: string[] = [];
    if (template.type === 'calculated' && template.formula) {
      requiredVariables = extractVariables(template.formula);
    } else if (template.type === 'aggregate' && template.aggregateField) {
      requiredVariables = [template.aggregateField];
    }

    const variableTypes: Record<string, 'field' | 'metric'> = {};
    requiredVariables.forEach(v => variableTypes[v] = 'field');

    setSelectedMetrics(prev => [...prev, {
      templateId,
      tempId: nanoid(),
      requiredVariables,
      variableTypes,
      bindings: {}
    }]);
  }, [templates]);

  const updateVariableType = useCallback((
    metricTempId: string, 
    alias: string, 
    type: 'field' | 'metric'
  ) => {
    setSelectedMetrics(prev => prev.map(m => {
      if (m.tempId !== metricTempId) return m;
      return {
        ...m,
        variableTypes: { ...m.variableTypes, [alias]: type },
        bindings: { ...m.bindings, [alias]: '' }
      };
    }));
  }, []);

  const updateBindingValue = useCallback((
    metricTempId: string, 
    alias: string, 
    value: string
  ) => {
    setSelectedMetrics(prev => prev.map(m => {
      if (m.tempId !== metricTempId) return m;
      return {
        ...m,
        bindings: { ...m.bindings, [alias]: value }
      };
    }));
  }, []);

  const removeMetric = useCallback((tempId: string) => {
    setSelectedMetrics(prev => prev.filter(m => m.tempId !== tempId));
  }, []);

  const saveGroup = useCallback(() => {
    if (!name.trim()) throw new Error("Введите название группы");

    const allFieldMappings: FieldBinding[] = [];
    const fieldMap = new Map<string, string>(); 

    selectedMetrics.forEach(m => {
      m.requiredVariables.forEach(alias => {
        if (m.variableTypes[alias] === 'field') {
          const colName = m.bindings[alias];
          if (colName && !fieldMap.has(alias)) {
             fieldMap.set(alias, colName);
             allFieldMappings.push({ id: nanoid(), fieldAlias: alias, columnName: colName });
          }
        }
      });
    });

    // Этап 1: Промежуточный массив
    const intermediateMetrics = selectedMetrics.map((m, index) => {
      return {
        tempId: m.tempId,
        finalId: m.originalMetricId || nanoid(),
        order: index,
        data: m
      };
    });
    
    // Этап 2: Финальная сборка
    const finalMetrics: GroupMetric[] = intermediateMetrics.map(item => {
      const m = item.data;
      const fBindings: FieldBinding[] = [];
      const mBindings: MetricBinding[] = [];

      m.requiredVariables.forEach((alias: string) => {
        const value = m.bindings[alias];
        if (!value) return;

        if (m.variableTypes[alias] === 'field') {
          fBindings.push({
             id: nanoid(), 
             fieldAlias: alias, 
             columnName: value 
          });
        } else {
          // Value - это tempId. Ищем finalId.
          const target = intermediateMetrics.find(x => x.tempId === value);
          const targetById = intermediateMetrics.find(x => x.finalId === value); // На всякий случай
          const resolvedTarget = target || targetById;

          if (resolvedTarget) {
            mBindings.push({
              id: nanoid(),
              metricAlias: alias,
              metricId: resolvedTarget.finalId
            });
          }
        }
      });

      return {
        id: item.finalId,
        templateId: m.templateId,
        order: item.order,
        enabled: true,
        fieldBindings: fBindings,
        metricBindings: mBindings
      };
    });

    const groupData = {
      name,
      fieldMappings: allFieldMappings,
      metrics: finalMetrics,
      order: 0,
    };

    if (existingGroupId) {
      updateGroup(existingGroupId, groupData);
      return existingGroupId;
    } else {
      return addGroup(groupData);
    }

  }, [name, selectedMetrics, addGroup, updateGroup, existingGroupId]);

  return {
    name, setName,
    selectedMetrics,
    addMetricToGroup,
    updateVariableType,
    updateBindingValue,
    removeMetric,
    saveGroup,
    availableTemplates: templates,
    availableColumns: columns
  };
}