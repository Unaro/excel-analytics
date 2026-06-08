import type { DashboardComputationResult, BreakdownItem, VirtualMetricValue } from '@/entities/metric';
import type { VirtualMetric } from '@/shared/lib/validators';

/**
 * Объединяет breakdown всех групп дашборда в один плоский массив.
 * 
 * Используется для ChartsSectionWidget, который работает с одним breakdown.
 * 
 * Логика:
 * - Если есть breakdown: объединяем с префиксом группы
 * - Если нет breakdown (лист иерархии): создаём отдельные элементы для каждой группы
 * - Виртуальные метрики дедуплицируются по ID (берём первую найденную)
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

  const allBreakdown: BreakdownItem[] = [];
  const hasAnyBreakdown = result.groups.some(g => g.breakdown && g.breakdown.length > 0);

  if (hasAnyBreakdown) {
    // ═══════════════════════════════════════════════════════════
    // СЛУЧАЙ 1: Есть breakdown - объединяем с префиксом группы
    // ═══════════════════════════════════════════════════════════
    for (const group of result.groups) {
      if (group.breakdown && group.breakdown.length > 0) {
        const labeled = group.breakdown.map(item => ({
          ...item,
          label: result.groups.length > 1 
            ? `${group.groupName} · ${item.label}` 
            : item.label,
        }));
        allBreakdown.push(...labeled);
      }
    }
  } else {
    // ═══════════════════════════════════════════════════════════
    // СЛУЧАЙ 2: Нет breakdown (лист иерархии)
    // Создаём ОТДЕЛЬНЫЕ элементы для каждой группы
    // ═══════════════════════════════════════════════════════════
    for (const group of result.groups) {
      allBreakdown.push({
        label: group.groupName,
        recordCount: group.recordCount,
        virtualMetrics: group.virtualMetrics,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Дедупликация виртуальных метрик
  // Берём уникальные метрики по virtualMetricId (первую найденную)
  // ═══════════════════════════════════════════════════════════
  const uniqueMetricsMap = new Map<string, VirtualMetricValue>();
  
  for (const group of result.groups) {
    for (const vm of group.virtualMetrics) {
      if (!uniqueMetricsMap.has(vm.virtualMetricId)) {
        uniqueMetricsMap.set(vm.virtualMetricId, vm);
      }
    }
  }

  const summaryVirtualMetrics = Array.from(uniqueMetricsMap.values());

  return {
    breakdown: allBreakdown,
    virtualMetrics: summaryVirtualMetrics,
  };
}