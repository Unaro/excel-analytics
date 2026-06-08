// entities/metric/model/computed-types.ts
// ─────────────────────────────────────────────────────────────
// Реэкспорт типов вычислений из shared для обратной совместимости.
// Все потребители внутри entities продолжают работать без изменений.
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
} from '@/shared/lib/types/computation';