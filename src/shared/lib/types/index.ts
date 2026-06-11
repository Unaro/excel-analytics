// shared/lib/types/index.ts
// ─────────────────────────────────────────────────────────────
// Barrel-экспорт всех shared-типов.
// ─────────────────────────────────────────────────────────────

export type {
  ComputationContext,
  ComputedMetricValue,
  VirtualMetricValue,
  BreakdownItem,
  GroupComputationResult,
  ActiveHierarchyFilter,
  DashboardComputationResult,
  MetricCache,
} from './computation';

export type {
  DatasetRow,
  ColumnClassification,
  ColumnConfig,
  ColumnStatistics,
} from './dataset';

export type {
  ColorConfig,
  KPIWidget,
  WidgetType,
  ChartConfig,
  TableConfig,
  MetricCardConfig,
  IndicatorGroupsTableConfig,
  DashboardWidget,
  Dashboard,
} from './dashboard';

export type {
  AggregateFunction,
  MetricType,
  DisplayFormat,
  MetricSourceType,
  MetricDependency,
} from './metric';

export type { GroupMetricConfig } from './group-metric-config';

export type { HierarchyFilterValue, HierarchyLevel } from './hierarchy';