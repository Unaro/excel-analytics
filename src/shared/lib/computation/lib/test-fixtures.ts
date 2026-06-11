/**
 * Фабрики тестовых данных для ядра вычислений.
 *
 * Используются только в *.test.ts — в продакшен-бандл не попадают
 * (модуль не импортируется приложением).
 */
import type {
  HierarchyFilterValue,
  IndicatorGroup,
  IndicatorGroupInDashboard,
  MetricTemplate,
  GroupMetric,
} from '@/shared/lib/validators';
import type { ClientComputeParams } from './types';

/** Создаёт aggregate-шаблон метрики (SUM по полю `value` по умолчанию). */
export function makeAggregateTemplate(
  over: Partial<MetricTemplate> = {}
): MetricTemplate {
  return {
    id: 'tpl-agg',
    name: 'Сумма',
    type: 'aggregate',
    aggregateFunction: 'SUM',
    aggregateField: 'value',
    dependencies: [{ type: 'field', alias: 'value' }],
    displayFormat: 'number',
    decimalPlaces: 0,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

/** Создаёт calculated-шаблон метрики с формулой. */
export function makeCalculatedTemplate(
  formula: string,
  over: Partial<MetricTemplate> = {}
): MetricTemplate {
  return {
    id: 'tpl-calc',
    name: 'Расчётная',
    type: 'calculated',
    formula,
    dependencies: [],
    displayFormat: 'number',
    decimalPlaces: 2,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

/** Создаёт метрику группы, привязанную к шаблону. */
export function makeGroupMetric(over: Partial<GroupMetric> = {}): GroupMetric {
  return {
    id: 'm1',
    templateId: 'tpl-agg',
    fieldBindings: [
      { id: 'fb1', fieldAlias: 'value', columnName: 'revenue' },
    ],
    metricBindings: [],
    enabled: true,
    order: 0,
    ...over,
  };
}

/** Создаёт группу показателей. */
export function makeGroup(over: Partial<IndicatorGroup> = {}): IndicatorGroup {
  return {
    id: 'g1',
    name: 'Группа 1',
    fieldMappings: [],
    metrics: [makeGroupMetric()],
    order: 0,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

/** Конфигурация группы на дашборде. */
export function makeGroupConfig(
  over: Partial<IndicatorGroupInDashboard> = {}
): IndicatorGroupInDashboard {
  return { groupId: 'g1', enabled: true, order: 0, ...over };
}

/** Фильтр иерархии. */
export function makeFilter(
  over: Partial<HierarchyFilterValue> = {}
): HierarchyFilterValue {
  return {
    levelId: 'lvl1',
    levelIndex: 0,
    columnName: 'region',
    value: 'Москва',
    ...over,
  };
}

/**
 * Собирает полный ClientComputeParams с одной aggregate-метрикой
 * (`g1__m1` = SUM(revenue)) — базовый сценарий для compileQuery.
 */
export function makeParams(
  over: Partial<ClientComputeParams> = {}
): ClientComputeParams {
  return {
    datasetId: 'ds1',
    dashboardId: 'db1',
    filters: [],
    groups: [makeGroup()],
    tableName: '"dt_ds1"',
    dashboardGroupsConfig: [makeGroupConfig()],
    metricTemplates: [makeAggregateTemplate()],
    virtualMetrics: [],
    ...over,
  };
}
