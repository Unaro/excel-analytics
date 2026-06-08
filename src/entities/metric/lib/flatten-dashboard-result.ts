import type { DashboardComputationResult, BreakdownItem, VirtualMetricValue } from '@/entities/metric';
import type { VirtualMetric } from '@/shared/lib/validators';

/**
 * Объединяет breakdown всех групп дашборда в один плоский массив.
 * Используется для ChartsSectionWidget, который работает с одним breakdown.
 *
 * Виртуальные метрики берутся из dashboard.virtualMetrics (с colorConfig),
 * а значения — из group.virtualMetrics.
 */
export function flattenDashboardResult(
  result: DashboardComputationResult | null,
  dashboardVirtualMetrics: VirtualMetric[]
): {
  breakdown: BreakdownItem[];
  virtualMetrics: VirtualMetricValue[];
} {
  if (!result || result.groups.length === 0) {
    return { breakdown: [], virtualMetrics: [] };
  }

  // Собираем все breakdown из всех групп
  const allBreakdown: BreakdownItem[] = [];
  for (const group of result.groups) {
    if (group.breakdown) {
      // Помечаем каждый элемент названием группы для контекста
      const labeled = group.breakdown.map(item => ({
        ...item,
        label: `${group.groupName} · ${item.label}`,
      }));
      allBreakdown.push(...labeled);
    }
  }

  // Если breakdown нет (лист иерархии), строим из summary
  if (allBreakdown.length === 0) {
    const summaryItem: BreakdownItem = {
      label: 'Итого',
      recordCount: result.totalRecords,
      virtualMetrics: result.groups.flatMap(g => g.virtualMetrics),
    };
    allBreakdown.push(summaryItem);
  }

  // Виртуальные метрики — summary-значения (сводные по всем группам)
  const summaryVirtualMetrics: VirtualMetricValue[] = result.groups.flatMap(
    g => g.virtualMetrics
  );

  return {
    breakdown: allBreakdown,
    virtualMetrics: summaryVirtualMetrics,
  };
}