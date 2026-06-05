import type { BreakdownItem } from '@/entities/metric';

/**
 * Сортирует элементы breakdown по указанному ключу.
 *
 * Поддерживаемые ключи:
 *  - 'label' — алфавитная сортировка по названию
 *  - 'recordCount' — сортировка по количеству записей
 *  - virtualMetricId — сортировка по значению метрики
 */
export function sortBreakdownItems(
  items: BreakdownItem[],
  sortKey: string,
  direction: 'asc' | 'desc'
): BreakdownItem[] {
  return [...items].sort((a, b) => {
    let aVal: number | string;
    let bVal: number | string;

    if (sortKey === 'label') {
      aVal = a.label;
      bVal = b.label;
    } else if (sortKey === 'recordCount') {
      aVal = a.recordCount;
      bVal = b.recordCount;
    } else {
      const aMetric = a.virtualMetrics.find(m => m.virtualMetricId === sortKey);
      const bMetric = b.virtualMetrics.find(m => m.virtualMetricId === sortKey);
      aVal = aMetric?.value ?? -Infinity;
      bVal = bMetric?.value ?? -Infinity;
    }

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return direction === 'asc'
        ? aVal.localeCompare(bVal, undefined, { numeric: true })
        : bVal.localeCompare(aVal, undefined, { numeric: true });
    }

    return direction === 'asc'
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number);
  });
}