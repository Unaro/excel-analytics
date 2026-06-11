// shared/lib/types/computation.ts
// ─────────────────────────────────────────────────────────────
// Публичные типы результатов вычислений.
// Контракт между слоями (entities ↔ shared ↔ widgets).
// Живут в shared, чтобы computation-engine не зависел от entities.
// ─────────────────────────────────────────────────────────────

import type { HierarchyFilterValue, VirtualMetric } from '@/shared/lib/validators';

/**
 * Контекст вычисления метрики.
 */
export interface ComputationContext {
  dashboardId: string;
  filters: HierarchyFilterValue[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}

/**
 * Вычисленное значение одной метрики.
 */
export interface ComputedMetricValue {
  metricId: string;
  groupId: string;
  value: number | null;
  formattedValue: string;
  context: ComputationContext;
  recordCount: number;
  computedAt: number;
  previousValue?: number;
  change?: number;
  changePercent?: number;
  error?: string;
}

/**
 * Вычисленное значение виртуальной метрики для одной группы.
 */
export interface VirtualMetricValue {
  virtualMetricId: string;
  virtualMetricName: string;
  value: number | null;
  formattedValue: string;
  sourceMetricId: string;
  error?: string;
}

/**
 * Одна строка в разбивке (breakdown) по дочернему уровню иерархии.
 */
export interface BreakdownItem {
  label: string;
  /**
   * Метка временно́го интервала при двумерной группировке
   * (категория × время). Отсутствует в одномерных режимах.
   */
  dateLabel?: string;
  recordCount: number;
  virtualMetrics: VirtualMetricValue[];
}

/**
 * Результат вычислений для одной группы показателей.
 */
export interface GroupComputationResult {
  groupId: string;
  groupName: string;
  virtualMetrics: VirtualMetricValue[];
  allMetrics?: ComputedMetricValue[];
  recordCount: number;
  computedAt: number;
  breakdown?: BreakdownItem[];
  /**
   * true — breakdown усечён до BREAKDOWN_LIMIT строк (значений группировки
   * больше лимита). UI обязан показать предупреждение: суммы по видимым
   * строкам не сойдутся с «Итого».
   */
  breakdownTruncated?: boolean;
}

/**
 * Активное значение иерархического фильтра (текущий выбор пользователя).
 */
export interface ActiveHierarchyFilter {
  levelName: string;
  levelId: string;
  columnName: string;
  value: string;
  displayValue: string;
  depth: number;
}

/**
 * Результат вычислений для всего дашборда.
 * Главный контракт между compute engine и UI-слоем.
 */
export interface DashboardComputationResult {
  dashboardId: string;
  hierarchyFilters: HierarchyFilterValue[];
  activeFilter: ActiveHierarchyFilter | null;
  virtualMetrics: VirtualMetric[];
  groups: GroupComputationResult[];
  totalRecords: number;
  computedAt: number;
  computationTime: number;
}

/**
 * Кеш вычисленных значений.
 */
export interface MetricCache {
  key: string;
  value: ComputedMetricValue;
  expiresAt: number;
}