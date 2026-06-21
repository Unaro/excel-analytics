'use client';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useIndicatorGroupStore } from '@/entities/indicator-group';
import { FieldBinding, GroupMetric, MetricBinding, useMetricTemplateStore } from '@/entities/metric';
import { useColumnConfigStore } from '@/entities/column-config';
import { nanoid } from 'nanoid';
import { extractVariables } from '@/shared/lib/utils/formula';
import { useDatasetStore } from '@/entities/dataset';
import { FormMetricState } from './types';
import type { ColumnConfig } from '@/shared/lib/types';

const EMPTY_COLUMNS: ColumnConfig[] = []

export function useGroupBuilder(existingGroupId?: string) {
  // Экшены стора стабильны — точечные селекторы вместо подписки на весь стор
  const addGroup = useIndicatorGroupStore(s => s.addGroup);
  const updateGroup = useIndicatorGroupStore(s => s.updateGroup);
  const getGroup = useIndicatorGroupStore(s => s.getGroup);
  const templates = useMetricTemplateStore((s) => s.templates);
  const activeDatasetId = useDatasetStore(s => s.activeDatasetId);
  const columns = useColumnConfigStore(s => 
    activeDatasetId ? (s.configsByDataset[activeDatasetId] ?? EMPTY_COLUMNS) : EMPTY_COLUMNS
  );

  const [name, setName] = useState('');
  const [selectedMetrics, setSelectedMetrics] = useState<FormMetricState[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [columnSearchQuery, setColumnSearchQuery] = useState('');

  // Авто-переключение на датасет редактируемой группы: в редактор можно
  // попасть из общего списка групп при любом активном датасете, а колонки
  // для привязок берутся из активного — без переключения они были бы чужими.
  useEffect(() => {
    if (!existingGroupId) return;
    const group = getGroup(existingGroupId);
    if (!group?.datasetId) return;
    if (group.datasetId === activeDatasetId) return;
    useDatasetStore.getState().switchDataset(group.datasetId);
  }, [existingGroupId, getGroup, activeDatasetId]);

  // --- 1. ВЫЧИСЛЕНИЕ СПИСКА КОЛОНОК ---
  const filteredColumns = useMemo(() => {
    if (!activeDatasetId || columns === EMPTY_COLUMNS) return [];
    return columns.filter(c => {
      const isUsed = selectedMetrics.some(m => Object.values(m.bindings).includes(c.columnName));
      if (isUsed) return true;
      if (!columnSearchQuery) return true;
      const query = columnSearchQuery;
      return (
        c.displayName.includes(query) ||
        c.columnName.includes(query) ||
        c.alias.includes(query)
      );
    });
  }, [columns, selectedMetrics, columnSearchQuery, activeDatasetId]);

  // --- 2. ЗАГРУЗКА СУЩЕСТВУЮЩЕЙ ГРУППЫ ---
  useEffect(() => {
    if (!activeDatasetId) return;
    if (existingGroupId && !isInitialized) {
      const group = getGroup(existingGroupId);
      if (group) {
        setName((prev) => (prev !== group.name ? group.name : prev));
        // Восстанавливаем «Контекст данных», чтобы не вводить заново.
        setColumnSearchQuery(group.columnContext ?? '');

      const restoredMetrics: FormMetricState[] = group.metrics.map((m, index) => {
        const template = templates.find(t => t.id === m.templateId);
        const requiredVars = template?.formula
          ? extractVariables(template.formula)
          : [];
        
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
        
        const metricId = nanoid();
        
        return {
          id: metricId,
          templateId: m.templateId,
          tempId: metricId,
          originalMetricId: m.id,
          unit: m.unit || '',
          customName: m.customName,
          requiredVariables: requiredVars,
          variableTypes,
          bindings
        };
      });
        
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
  }, [existingGroupId, getGroup, isInitialized, templates, activeDatasetId]);

  const addMetricToGroup = useCallback((templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;
    
    const requiredVariables = template.formula
      ? extractVariables(template.formula)
      : [];

    const variableTypes: Record<string, 'field' | 'metric'> = {};
    requiredVariables.forEach(v => variableTypes[v] = 'field');
    
    const metricId = nanoid();
    
    setSelectedMetrics(prev => [...prev, {
      id: metricId,
      tempId: metricId,
      templateId,
      requiredVariables,
      unit: '',
      customName: '',
      variableTypes,
      bindings: {}
    }]);
  }, [templates]);


  const updateMetricCustomName = useCallback((tempId: string, customName: string) => {
    setSelectedMetrics(prev => prev.map(m =>
      m.tempId === tempId ? { ...m, customName } : m
    ));
  }, []);

  // Обновление единицы измерения
  const updateMetricUnit = useCallback((tempId: string, unit: string) => {
    setSelectedMetrics(prev => prev.map(m =>
      m.tempId === tempId ? { ...m, unit } : m
    ));
  }, []);

  // Обновление типа переменной (поле/метрика)
  const updateVariableType = useCallback((
    metricTempId: string,
    alias: string,
    type: 'field' | 'metric'
  ) => {
    setSelectedMetrics(prev => prev.map((m, index) => {
      if (m.tempId !== metricTempId) return m;
      let newValue = '';
      if (type === 'metric' && index > 0) {
        newValue = prev[index - 1].tempId;
      }
      return {
        ...m,
        variableTypes: { ...m.variableTypes, [alias]: type },
        bindings: { ...m.bindings, [alias]: newValue }
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
      return { ...m, bindings: { ...m.bindings, [alias]: value } };
    }));
  }, []);

  const removeMetric = useCallback((tempId: string) => {
    setSelectedMetrics(prev => prev.filter(m => m.tempId !== tempId));
  }, []);

  const reorderMetrics = useCallback((newOrder: FormMetricState[]) => {
    setSelectedMetrics(newOrder);
  }, []);

  // --- 4. СОХРАНЕНИЕ ГРУППЫ ---
  const saveGroup = useCallback(() => {
    if (!name.trim()) throw new Error("Введите название группы");
    if (!activeDatasetId) throw new Error("Не выбран датасет");
    
    const allFieldMappings: FieldBinding[] = [];
    const uniqueColumnNames = new Set<string>();
    
    // Сбор глобальных маппингов полей
    selectedMetrics.forEach(m => {
      m.requiredVariables.forEach(alias => {
        if (m.variableTypes[alias] === 'field') {
          const colName = m.bindings[alias];
          if (colName && !uniqueColumnNames.has(colName)) {
            uniqueColumnNames.add(colName);
            allFieldMappings.push({ id: nanoid(), fieldAlias: alias, columnName: colName });
          }
        }
      });
    });
    
    // Этап 1: Промежуточные ID — порядок берём из selectedMetrics (который может быть изменён drag-and-drop)
    const intermediateMetrics = selectedMetrics.map((m, index) => ({
      tempId: m.tempId,
      finalId: m.originalMetricId || nanoid(),
      order: index,
      data: m
    }));
    
    // Этап 2: Финальная сборка GroupMetric
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
        customName: m.customName || undefined,
        fieldBindings: fBindings,
        metricBindings: mBindings
      };
    });
    
    const groupData = {
      name,
      fieldMappings: allFieldMappings,
      metrics: finalMetrics,
      columnContext: columnSearchQuery.trim() || undefined,
      order: 0,
    };
    
    if (existingGroupId) {
      updateGroup(existingGroupId, groupData);
      return existingGroupId;
    } else {
      if (!activeDatasetId) throw new Error("Не выбран датасет");
      return addGroup(groupData, activeDatasetId);
    }
  }, [name, selectedMetrics, columnSearchQuery, addGroup, updateGroup, existingGroupId, activeDatasetId]);

  return {
    name, setName,
    selectedMetrics,
    addMetricToGroup,
    updateVariableType,
    updateBindingValue,
    removeMetric,
    reorderMetrics, 
    saveGroup,
    availableTemplates: templates,
    availableColumns: filteredColumns,
    columnSearchQuery,
    setColumnSearchQuery,
    updateMetricUnit,
    updateMetricCustomName,
  };
}