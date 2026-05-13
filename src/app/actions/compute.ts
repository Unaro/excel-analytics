'use server';
import { safeEvaluate, validateFormula } from '@/lib/logic/safe-math';
import {
  ComputeParamsSchema
} from '@/lib/logic/validators';
import type {
  DashboardComputationResult,
  GroupComputationResult,
  VirtualMetricValue,
  ActiveHierarchyFilter,
  ExcelRow,
  IndicatorGroup,
  HierarchyFilterValue,
  VirtualMetric,
  IndicatorGroupInDashboard,
  MetricTemplate,
  GroupMetric
} from '@/types';
import { z } from 'zod';

type AggregateFn = 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'COUNT' | 'COUNT_DISTINCT' | 'MEDIAN' | 'PERCENTILE';

/**
 * Нормализация значения для строгого строкового сравнения
 */
function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/**
 * Фильтрация данных по иерархическим фильтрам
 */
function filterDataByHierarchy(data: ExcelRow[], filters: HierarchyFilterValue[]): ExcelRow[] {
  if (filters.length === 0) return data;
  
  return data.filter((row) =>
    filters.every((filter) => normalizeValue(row[filter.columnName]) === normalizeValue(filter.value))
  );
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
  // COUNT считает все не-null значения независимо от типа
  if (fn === 'COUNT') {
    return data.filter((r) => r[col] != null && r[col] !== '').length;
  }

  const nums = data
    .map((r) => r[col])
    .filter((v) => v != null && typeof v === 'number') as number[];

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

    // Поля агрегируются как SUM (архитектурное ограничение, можно расширить)
    for (const fb of metric.fieldBindings) {
      const nums = data
        .map((r) => r[fb.columnName])
        .filter((v) => v != null && typeof v === 'number') as number[];
      scope[fb.fieldAlias] = nums.reduce((a, b) => a + b, 0);
    }

    // Зависимости от других метрик
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
  let res: string;
  switch (format) {
    case 'decimal':
      res = value.toLocaleString('ru-RU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      break;
    case 'percent':
      res = `${(value * 100).toFixed(decimals)}%`;
      break;
    case 'currency':
      res = value.toLocaleString('ru-RU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      break;
    case 'scientific':
      res = value.toExponential(decimals);
      break;
    default:
      res = value.toFixed(decimals);
  }
  return unit && format !== 'percent' ? `${res}${unit}` : res;
}

/**
 * 🟢 ГЛАВНЫЙ SERVER ACTION: Вычисление метрик дашборда
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