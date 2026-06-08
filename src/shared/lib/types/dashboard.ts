// shared/lib/types/dashboard.ts
// ─────────────────────────────────────────────────────────────
// Типы контрактов дашборда, используемые за пределами entity.
// KPIWidget нужен kpi-compiler.ts в shared/lib/computation.
// ─────────────────────────────────────────────────────────────

import type { MetricColor } from '@/shared/lib/utils/metric-colors';

/**
 * KPI-виджет (карточка с одной метрикой).
 */
export interface KPIWidget {
  id: string;
  templateId: string;
  bindings: Record<string, string>;
  customName?: string;
  color?: MetricColor;
}