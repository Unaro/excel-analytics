'use server';

import { safeEvaluate, validateFormula } from '@/lib/logic/safe-math';
import {
  ComputeParamsSchema,
  type ExcelRow,
  type IndicatorGroup,
  type HierarchyFilterValue,
  type VirtualMetric,
  type IndicatorGroupInDashboard,
  type MetricTemplate,
  type GroupMetric,
} from '@/lib/logic/validators';
import type {
  DashboardComputationResult,
  GroupComputationResult,
  VirtualMetricValue,
  ActiveHierarchyFilter,
} from '@/types';
import { z } from 'zod';

/**
 * Вычисление метрик для дашборда на сервере
 */
export async function computeDashboardMetrics(rawParams: unknown): Promise<DashboardComputationResult> {
  const startTime = Date.now();

  // 1. Валидация входных данных через Zod
  let params: z.infer<typeof ComputeParamsSchema>;
  
  try {
    params = ComputeParamsSchema.parse(rawParams);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      throw new Error(`Ошибка валидации данных: ${messages}`);
    }
    throw new Error('Неверный формат параметров вычисления');
  }

  const {
    data,
    allGroups,
    dashboardGroupsConfig,
    metricTemplates,
    virtualMetrics,
    filters,
    dashboardId
  } = params;
  
  // Фильтрация данных по иерархии
  const filteredData = filterDataByHierarchy(data, filters);
  
  // Вычисление метрик для каждой группы
  const groupResults: GroupComputationResult[] = [];
  
  for (const dashboardGroup of dashboardGroupsConfig) {
    if (!dashboardGroup.enabled) continue;

    // Находим полное определение группы (где лежат метрики и формулы)
    const fullGroupDef = allGroups.find(g => g.id === dashboardGroup.groupId);
    
    if (!fullGroupDef) {
       console.warn(`Group definition not found for ID: ${dashboardGroup.groupId}`);
       continue;
    }

    try {
      const result = await computeGroupMetrics(
        fullGroupDef,
        dashboardGroup,
        filteredData,
        metricTemplates,
        virtualMetrics
      );
      groupResults.push(result);
    } catch (error) {
      console.error(`Error computing group ${fullGroupDef.name}:`, error);
      // Добавляем пустой результат с ошибкой
      groupResults.push({
        groupId: dashboardGroup.groupId,
        groupName: fullGroupDef.name,
        virtualMetrics: virtualMetrics.map(vm => ({
          virtualMetricId: vm.id,
          virtualMetricName: vm.name,
          value: null,
          formattedValue: 'Error',
          sourceMetricId: '',
          error: error instanceof Error ? error.message : 'Unknown error',
        })),
        recordCount: 0,
        computedAt: Date.now(),
      });
    }
  }
  
  const activeFilter = getActiveFilter(filters);
  
  return {
    dashboardId,
    hierarchyFilters: filters,
    activeFilter,
    virtualMetrics,
    groups: groupResults,
    totalRecords: filteredData.length,
    computedAt: Date.now(),
    computationTime: Date.now() - startTime,
  };
}

/**
 * Фильтрация данных по иерархическим фильтрам
 * ИСПРАВЛЕННАЯ ВЕРСИЯ
 */
function filterDataByHierarchy(
  data: ExcelRow[],
  filters: HierarchyFilterValue[]
): ExcelRow[] {
  if (filters.length === 0) return data;
  
  return data.filter((row) => {
    return filters.every((filter) => {
      // Получаем значение из строки Excel
      const rawRowValue = row[filter.columnName];
      
      // Нормализуем оба значения перед сравнением
      const rowValue = normalizeValue(rawRowValue);
      const filterValue = normalizeValue(filter.value);
      
      // Сравниваем строки
      // Можно добавить .toLowerCase(), если регистр не важен, но для кодов (ОКТМО) лучше оставить как есть
      return rowValue === filterValue;
    });
  });
}

/**
 * Получить активный фильтр (самый глубокий уровень)
 */
function getActiveFilter(
  filters: HierarchyFilterValue[]
): ActiveHierarchyFilter | null {
  if (filters.length === 0) return null;
  
  const lastFilter = filters[filters.length - 1];
  
  return {
    levelName: lastFilter.columnName,
    levelId: lastFilter.levelId,
    columnName: lastFilter.columnName,
    value: lastFilter.value,
    displayValue: lastFilter.displayValue ?? lastFilter.value,
    depth: lastFilter.levelIndex,
  };
}

/**
 * Хелпер для нормализации значений перед сравнением
 * Превращает числа и строки в очищенные строки
 */
function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  // Приводим к строке и убираем пробелы по краям
  return String(value).trim();
}

/**
 * Вычисление метрик для одной группы показателей
 */
async function computeGroupMetrics(
  groupDef: IndicatorGroup,
  dashboardConfig: IndicatorGroupInDashboard,
  data: ExcelRow[],
  metricTemplates: MetricTemplate[],
  virtualMetrics: VirtualMetric[]
): Promise<GroupComputationResult> {
  // Сортируем метрики по порядку вычисления
  const sortedMetrics = [...groupDef.metrics].sort((a, b) => a.order - b.order);
  
  // Кеш вычисленных значений метрик (для зависимостей)
  const metricValues = new Map<string, number | null>();
  
  // Вычисляем каждую метрику
  for (const metric of sortedMetrics) {
    if (!metric.enabled) continue;
    
    const template = metricTemplates.find(t => t.id === metric.templateId);
    if (!template) continue;
    
    try {
      const value = await computeMetric(metric, template, data, metricValues);
      metricValues.set(metric.id, value);
    } catch (error) {
      console.error(`Error computing metric ${metric.id}:`, error);
      metricValues.set(metric.id, null);
    }
  }
  
  // Формируем результаты виртуальных метрик на основе КОНФИГУРАЦИИ ДАШБОРДА
  const virtualMetricResults: VirtualMetricValue[] = virtualMetrics.map(vm => {
    // Ищем привязку в настройках дашборда для этой группы
    const binding = dashboardConfig.virtualMetricBindings?.find(
      vmb => vmb.virtualMetricId === vm.id
    );
    
    if (!binding) {
      return {
        virtualMetricId: vm.id,
        virtualMetricName: vm.name,
        value: null,
        formattedValue: '—',
        sourceMetricId: '',
      };
    }
    
    const value = metricValues.get(binding.metricId) ?? null;
    const formattedValue = formatValue(value, vm.displayFormat, vm.decimalPlaces, vm.unit);
    
    return {
      virtualMetricId: vm.id,
      virtualMetricName: vm.name,
      value,
      formattedValue,
      sourceMetricId: binding.metricId,
    };
  });
  
  return {
    groupId: groupDef.id,
    groupName: groupDef.name,
    virtualMetrics: virtualMetricResults,
    recordCount: data.length,
    computedAt: Date.now(),
  };
}

/**
 * Вычисление одной метрики
 */
async function computeMetric(
  metric: GroupMetric,
  template: MetricTemplate,
  data: ExcelRow[],
  metricValues: Map<string, number | null>
): Promise<number | null> {
  if (template.type === 'aggregate') {
    return computeAggregateMetric(metric, template, data);
  } else {
    return computeCalculatedMetric(metric, template, data, metricValues);
  }
}



/**
 * Вычисление агрегированной метрики
 */
function computeAggregateMetric(
  metric: GroupMetric,
  template: MetricTemplate,
  data: ExcelRow[]
): number | null {
  if (!template.aggregateFunction || !template.aggregateField) {
    return null;
  }
  
  // Находим привязку поля
  const fieldBinding = metric.fieldBindings.find(
    fb => fb.fieldAlias === template.aggregateField
  );
  
  if (!fieldBinding) {
    return null;
  }
  
  // Извлекаем значения колонки
  const values = data
    .map(row => row[fieldBinding.columnName])
    .filter(v => v != null && typeof v === 'number') as number[];
  
  if (values.length === 0) return null;
  
  // Применяем функцию агрегации
  switch (template.aggregateFunction) {
    case 'SUM':
      return values.reduce((a, b) => a + b, 0);
    
    case 'AVG':
      return values.reduce((a, b) => a + b, 0) / values.length;
    
    case 'MIN':
      return Math.min(...values);
    
    case 'MAX':
      return Math.max(...values);
    
    case 'COUNT':
      return values.length;
    
    case 'COUNT_DISTINCT':
      return new Set(values).size;
    
    case 'MEDIAN':
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
    
    default:
      return null;
  }
}

/**
 * Вычисление calculated метрики (формула)
 */
function computeCalculatedMetric(
  metric: GroupMetric,
  template: MetricTemplate,
  data: ExcelRow[],
  metricValues: Map<string, number | null>
): number | null {
  if (!template.formula) return null;

  try {
    // 1. Валидация формулы на безопасность
    validateFormula(template.formula);
    
    // 2. Создаем scope для вычисления формулы
    const scope: Record<string, number> = {};

    // Добавляем значения полей (пока что SUM по умолчанию для формул)
    for (const fieldBinding of metric.fieldBindings) {
      const values = data
        .map(row => row[fieldBinding.columnName])
        .filter(v => v != null && typeof v === 'number') as number[];

      scope[fieldBinding.fieldAlias] = values.length > 0
        ? values.reduce((a, b) => a + b, 0)
        : 0; // Заменяем null на 0 для безопасного вычисления
    }

    // Добавляем значения других метрик (зависимости)
    for (const metricBinding of metric.metricBindings) {
      const value = metricValues.get(metricBinding.metricId);
      // Заменяем null на 0 для безопасного вычисления
      scope[metricBinding.metricAlias] = value ?? 0;
    }

    // 3. Безопасное вычисление формулы
    const result = safeEvaluate(template.formula, scope);

    return result;
  } catch (error) {
    console.error('Error evaluating formula:', error);
    return null;
  }
}

/**
 * Форматирование значения
 */
function formatValue(
  value: number | null,
  format: string,
  decimalPlaces: number,
  unit?: string
): string {
  if (value === null) return '—';
  
  let formatted: string;
  
  switch (format) {
    case 'number':
      formatted = value.toFixed(decimalPlaces);
      break;
    
    case 'decimal':
      formatted = value.toLocaleString('ru-RU', {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      });
      break;
    
    case 'percent':
      formatted = (value * 100).toFixed(decimalPlaces);
      break;
    
    case 'currency':
      formatted = value.toLocaleString('ru-RU', {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      });
      break;
    
    case 'scientific':
      formatted = value.toExponential(decimalPlaces);
      break;
    
    default:
      formatted = value.toFixed(decimalPlaces);
  }
  
  return unit ? `${formatted}${unit}` : formatted;
}