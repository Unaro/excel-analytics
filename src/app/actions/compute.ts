'use server';

import {
  ComputeParamsSchema,
  ExcelRow,
  GroupMetric,
  HierarchyFilterValue,
  IndicatorGroup,
  IndicatorGroupInDashboard,
  MetricTemplate,
  VirtualMetric
} from '@/shared/lib/validators';
import { safeEvaluate, validateFormula } from '@/shared/lib/math/safe-math';

import { z } from 'zod';
import { ActiveHierarchyFilter, DashboardComputationResult, GroupComputationResult, VirtualMetricValue } from '@/entities/metric';

type AggregateFn = 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'COUNT' | 'COUNT_DISTINCT' | 'MEDIAN' | 'PERCENTILE';

/**
 * Нормализация значения для строгого строкового сравнения
 */
function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim().replace(',', '.');
}

/**
 * Безопасное преобразование значения в число с поддержкой float.
 * Обрабатывает строки вида "12.5" и "12,5" (RU формат).
 */
function parseToFloat(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const str = value.trim();
    if (str === '') return null;
    
    const normalized = str.replace(/\s/g, '').replace(',', '.');
    
    const num = parseFloat(normalized);
    return isFinite(num) ? num : null;
  }
  return null;
}

/**
 * Фильтрация данных по иерархическим фильтрам
 */
function filterDataByHierarchy(data: ExcelRow[], filters: HierarchyFilterValue[]): ExcelRow[] {
  if (filters.length === 0) return data;
  
  return data.filter((row) => {
      return filters.every((filter) => {
      const rawVal = row[filter.columnName];
      // Нормализуем к строке для сравнения
      const rowStr = rawVal != null ? String(rawVal).trim() : '';
      const filterVal = filter.value.trim();
      
      // Если оператор не указан или 'exact' → старое поведение
      if (!filter.operator || filter.operator === 'exact') {
        return rowStr === filterVal;
      }

      let rowTs: number;
      if (rawVal instanceof Date) {
        rowTs = rawVal.getTime();
      } else {
        const isoDate = rowStr.replace(/^(\d{2})\.(\d{2})\.(\d{4})$/, '$3-$2-$1');
        rowTs = new Date(isoDate).getTime();
      }

      const filterIso = filterVal.replace(/^(\d{2})\.(\d{2})\.(\d{4})$/, '$3-$2-$1');
      const filterTs = new Date(filterIso).getTime();

      const filterTs2 = filter.value2 ? new Date(filter.value2.replace(/^(\d{2})\.(\d{2})\.(\d{4})$/, '$3-$2-$1')).getTime() : filterTs;

      if (isNaN(rowTs) || isNaN(filterTs)) return false;

      switch (filter.operator) {
        case '>': return rowTs > filterTs;
        case '<': return rowTs < filterTs;
        case '>=': return rowTs >= filterTs;
        case '<=': return rowTs <= filterTs;
        case 'between': return rowTs >= filterTs && rowTs <= filterTs2;
        default: return rowStr === filterVal;
      }
    });
  });
}

/**
 * Получить активный (самый глубокий) фильтр
 */
function getActiveFilter(filters: HierarchyFilterValue[]): ActiveHierarchyFilter | null {
  if (filters.length === 0) return null;
  const last = filters[filters.length - 1];
  return {
    levelName: last.columnName,
    levelId: last.levelId,
    columnName: last.columnName,
    value: last.value,
    displayValue: last.displayValue ?? last.value,
    depth: last.levelIndex,
  };
}

/**
 * Вычисление агрегированной метрики
 */
function computeAggregateMetric(
  metric: GroupMetric,
  template: MetricTemplate,
  data: ExcelRow[]
): number | null {
  const fn = template.aggregateFunction as AggregateFn | undefined;
  const field = template.aggregateField;
  if (!fn || !field) return null;
  const binding = metric.fieldBindings.find((fb) => fb.fieldAlias === field);
  if (!binding) return null;
  const col = binding.columnName;

  if (fn === 'COUNT') {
    return data.filter((r) => {
      const val = r[col];
      return val != null && String(val).trim() !== '';
    }).length;
  }

  const nums = data
    .map((r) => parseToFloat(r[col]))
    .filter((v) => v !== null) as number[];

  if (nums.length === 0) return null;

  switch (fn) {
    case 'SUM': return nums.reduce((a, b) => a + b, 0);
    case 'AVG': return nums.reduce((a, b) => a + b, 0) / nums.length;
    case 'MIN': return Math.min(...nums);
    case 'MAX': return Math.max(...nums);
    case 'COUNT_DISTINCT': return new Set(nums).size;
    case 'MEDIAN': {
      const sorted = [...nums].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    }
    default: return null;
  }
}

/**
 * Вычисление формульной метрики
 */
function computeCalculatedMetric(
  metric: GroupMetric,
  template: MetricTemplate,
  data: ExcelRow[],
  metricValues: Map<string, number | null>
): number | null {
  if (!template.formula) return null;
  try {
    validateFormula(template.formula);
    const scope: Record<string, number> = {};
    
    for (const fb of metric.fieldBindings) {
      const nums = data
        .map((r) => parseToFloat(r[fb.columnName]))
        .filter((v) => v !== null) as number[];
      
      scope[fb.fieldAlias] = nums.reduce((a, b) => a + b, 0);
    }
    
    for (const mb of metric.metricBindings) {
      scope[mb.metricAlias] = metricValues.get(mb.metricId) ?? 0;
    }
    return safeEvaluate(template.formula, scope);
  } catch (error) {
    console.error(`[compute] Formula error in metric ${metric.id}:`, error);
    return null;
  }
}


/**
 * Вычисление метрик одной группы
 */
async function computeGroupMetrics(
  groupDef: IndicatorGroup,
  dashboardConfig: IndicatorGroupInDashboard,
  data: ExcelRow[],
  templates: MetricTemplate[],
  virtualMetrics: VirtualMetric[]
): Promise<GroupComputationResult> {
  const sortedMetrics = [...groupDef.metrics].sort((a, b) => a.order - b.order);
  const metricValues = new Map<string, number | null>();

  for (const metric of sortedMetrics) {
    if (!metric.enabled) continue;
    const tpl = templates.find((t) => t.id === metric.templateId);
    if (!tpl) continue;

    try {
      const val = tpl.type === 'aggregate'
        ? computeAggregateMetric(metric, tpl, data)
        : computeCalculatedMetric(metric, tpl, data, metricValues);
      metricValues.set(metric.id, val);
    } catch (err) {
      console.error(`[compute] Metric ${metric.id} failed:`, err);
      metricValues.set(metric.id, null);
    }
  }

  const virtualMetricResults: VirtualMetricValue[] = virtualMetrics.map((vm) => {
    const binding = dashboardConfig.virtualMetricBindings?.find((b) => b.virtualMetricId === vm.id);
    if (!binding) {
      return { virtualMetricId: vm.id, virtualMetricName: vm.name, value: null, formattedValue: '—', sourceMetricId: '' };
    }
    const value = metricValues.get(binding.metricId) ?? null;
    return {
      virtualMetricId: vm.id,
      virtualMetricName: vm.name,
      value,
      formattedValue: formatValue(value, vm.displayFormat, vm.decimalPlaces, vm.unit),
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
 * Форматирование числа под тип отображения
 */
function formatValue(value: number | null, format: string, decimals: number, unit?: string): string {
  if (value === null) return '—';

  const preciseRound = (num: number, d: number) => {
    const factor = Math.pow(10, d);
    return Math.round((num + Number.EPSILON) * factor) / factor;
  };

  let res: string;
  switch (format) {
    case 'decimal':
    case 'currency': {
      const rounded = preciseRound(value, decimals);
      res = rounded.toLocaleString('ru-RU', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
      break;
    }
    case 'percent': {
      const rounded = preciseRound(value * 100, decimals);
      res = `${rounded}%`;
      break;
    }
    case 'scientific':
      res = value.toExponential(decimals);
      break;
    default: {
      const rounded = preciseRound(value, decimals);
      res = rounded.toLocaleString('ru-RU', { maximumFractionDigits: decimals });
    }
  }
  return unit && format !== 'percent' ? `${res} ${unit}` : res;
}
/**
 * Вычисление метрик дашборда
 */
export async function computeDashboardMetrics(rawParams: unknown): Promise<DashboardComputationResult> {
  const start = Date.now();
  let params: z.infer<typeof ComputeParamsSchema>;
  try {
    params = ComputeParamsSchema.parse(rawParams);
  } catch (error) {
    const msg = error instanceof z.ZodError
      ? error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
      : 'Неверный формат параметров';
    throw new Error(`[compute] Validation error: ${msg}`);
  }

  const { data, allGroups, dashboardGroupsConfig, metricTemplates, virtualMetrics, filters, dashboardId } = params;
  const filteredData = filterDataByHierarchy(data, filters);
  const groupResults: GroupComputationResult[] = [];

  for (const cfg of dashboardGroupsConfig) {
    if (!cfg.enabled) continue;
    const groupDef = allGroups.find((g) => g.id === cfg.groupId);
    if (!groupDef) {
      console.warn(`[compute] Group not found: ${cfg.groupId}`);
      continue;
    }
    try {
      groupResults.push(await computeGroupMetrics(groupDef, cfg, filteredData, metricTemplates, virtualMetrics));
    } catch (err) {
      console.error(`[compute] Group ${groupDef.name} failed:`, err);
      groupResults.push({
        groupId: cfg.groupId,
        groupName: groupDef.name,
        virtualMetrics: virtualMetrics.map((vm) => ({
          virtualMetricId: vm.id,
          virtualMetricName: vm.name,
          value: null,
          formattedValue: 'Error',
          sourceMetricId: '',
          error: err instanceof Error ? err.message : 'Unknown',
        })),
        recordCount: 0,
        computedAt: Date.now(),
      });
    }
  }

  return {
    dashboardId,
    hierarchyFilters: filters,
    activeFilter: getActiveFilter(filters),
    virtualMetrics,
    groups: groupResults,
    totalRecords: filteredData.length,
    computedAt: Date.now(),
    computationTime: Date.now() - start,
  };
}