'use client';

import { useState, useCallback, useEffect } from 'react';
import { useIndicatorGroupStore } from '@/entities/indicatorGroup';
import { useMetricTemplateStore } from '@/entities/metric';
import { useColumnConfigStore } from '@/entities/excelData';
import { FieldBinding, GroupMetric, MetricBinding } from '@/types';
import { nanoid } from 'nanoid';
import { extractVariables } from '@/shared/lib/utils/formula';

export interface FormMetricState {
  templateId: string;
  tempId: string;
  unit: string; 
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
  const [columnSearchQuery, setColumnSearchQuery] = useState(''); // Поиск колонок

  // --- 1. ВЫЧИСЛЕНИЕ СПИСКА КОЛОНОК ---
  const filteredColumns = columns.filter(c => {
    const isUsed = selectedMetrics.some(m => Object.values(m.bindings).includes(c.columnName));
    if (isUsed) return true;
    if (!columnSearchQuery) return true;
    const query = columnSearchQuery.toLowerCase();
    return (
      c.displayName.toLowerCase().includes(query) || 
      c.columnName.toLowerCase().includes(query) ||
      c.alias.toLowerCase().includes(query)
    );
  });

  // --- 2. ЗАГРУЗКА ---
  useEffect(() => {
    if (existingGroupId && !isInitialized) {
      const group = getGroup(existingGroupId);
      if (group) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setName((prev) => (prev !== group.name ? group.name : prev));
        
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
             bindings[mb.metricAlias] = mb.metricId;
             variableTypes[mb.metricAlias] = 'metric';
          });

          return {
            templateId: m.templateId,
            tempId: nanoid(),
            originalMetricId: m.id,
            unit: m.unit || '', 
            requiredVariables: requiredVars,
            variableTypes,
            bindings
          };
        });

        // Маппинг ID (восстановление связей)
        const idMap = new Map<string, string>();
        restoredMetrics.forEach(m => {
          if (m.originalMetricId) idMap.set(m.originalMetricId, m.tempId);
        });

        const fixedMetrics = restoredMetrics.map(m => {
          const newBindings = { ...m.bindings };
          Object.keys(newBindings).forEach(alias => {
            if (m.variableTypes[alias] === 'metric') {
              const oldId = newBindings[alias];
              if (idMap.has(oldId)) {
                newBindings[alias] = idMap.get(oldId)!;
              }
            }
          });
          return { ...m, bindings: newBindings };
        });

        setSelectedMetrics(fixedMetrics);
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
      unit: '', 
      variableTypes,
      bindings: {}
    }]);
  }, [templates]);

  // НОВАЯ ФУНКЦИЯ: Обновление единицы измерения
  const updateMetricUnit = useCallback((tempId: string, unit: string) => {
    setSelectedMetrics(prev => prev.map(m => 
      m.tempId === tempId ? { ...m, unit } : m
    ));
  }, []);

  // --- 3. ОБНОВЛЕНИЕ ТИПА (С АВТО-ВЫБОРОМ) ---
  const updateVariableType = useCallback((
    metricTempId: string, 
    alias: string, 
    type: 'field' | 'metric'
  ) => {
    setSelectedMetrics(prev => prev.map((m, index) => {
      if (m.tempId !== metricTempId) return m;
      
      let newValue = '';
      
      // UX УЛУЧШЕНИЕ: Если переключили на метрику, пробуем найти первую доступную выше
      if (type === 'metric') {
        if (index > 0) {
          // Берем метрику сразу над текущей (чаще всего ссылаются на нее)
          newValue = prev[index - 1].tempId;
        }
      }

      return {
        ...m,
        variableTypes: { ...m.variableTypes, [alias]: type },
        bindings: { ...m.bindings, [alias]: newValue } // Авто-подстановка
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

  // --- 4. СОХРАНЕНИЕ (ИСПРАВЛЕННАЯ ЛОГИКА) ---
  const saveGroup = useCallback(() => {
    if (!name.trim()) throw new Error("Введите название группы");

    const allFieldMappings: FieldBinding[] = [];
    const uniqueColumnNames = new Set<string>(); // Сет для проверки уникальности КОЛОНОК

    // Сбор глобальных маппингов полей
    selectedMetrics.forEach(m => {
      m.requiredVariables.forEach(alias => {
        if (m.variableTypes[alias] === 'field') {
          const colName = m.bindings[alias];
          
          // ИСПРАВЛЕНИЕ: Проверяем уникальность по имени колонки Excel, а не по алиасу переменной (value)
          if (colName && !uniqueColumnNames.has(colName)) {
             uniqueColumnNames.add(colName);
             // Алиас сохраняем, но он не так важен для глобального списка, главное что колонка учтена
             allFieldMappings.push({ id: nanoid(), fieldAlias: alias, columnName: colName });
          }
        }
      });
    });

    // Этап 1: Промежуточные ID
    const intermediateMetrics = selectedMetrics.map((m, index) => ({
      tempId: m.tempId,
      finalId: m.originalMetricId || nanoid(),
      order: index,
      data: m
    }));
    
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
          const target = intermediateMetrics.find(x => x.tempId === value);
          const targetById = intermediateMetrics.find(x => x.finalId === value);
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
        unit: m.unit, 
        fieldBindings: fBindings,
        metricBindings: mBindings
      };
    });

    const groupData = {
      name,
      fieldMappings: allFieldMappings, // Теперь тут правильный список уникальных колонок
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
    availableColumns: filteredColumns,
    columnSearchQuery,
    updateMetricUnit,
    setColumnSearchQuery
  };
}