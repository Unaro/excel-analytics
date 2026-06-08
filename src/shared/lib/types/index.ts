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

export type { KPIWidget } from './dashboard';

export type { HierarchyFilterValue } from './hierarchy';