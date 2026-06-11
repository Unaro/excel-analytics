// entities/dashboard/model/types.ts
// ─────────────────────────────────────────────────────────────
// Контракт дашборда перенесён в shared/lib/types/dashboard
// (используется сервисами shared/lib/services и kpi-compiler).
// Здесь — ре-экспорт как public API entity для обратной совместимости.
// ─────────────────────────────────────────────────────────────

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
} from '@/shared/lib/types/dashboard';
