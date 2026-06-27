// Построение данных для treemap: категории разбивки → {name, value} по одной
// метрике, в масштабе отображения (как бары) и только положительные (площадь
// treemap не сайзит ноль/отрицательные). Чистая функция — тестируется отдельно.

import type { BreakdownItem } from '@/entities/metric';
import { toDisplayScale } from '@/shared/lib/utils/metric-colors';
import type { TreemapDatum } from '../ui/Chart/GroupTreemapChart';

export function buildTreemapData(
  breakdown: BreakdownItem[],
  metricId: string,
  format?: string
): TreemapDatum[] {
  const out: TreemapDatum[] = [];
  for (const item of breakdown) {
    const raw = item.virtualMetrics.find(m => m.virtualMetricId === metricId)?.value;
    if (raw == null) continue;
    const value = toDisplayScale(raw, format);
    if (value > 0) out.push({ name: item.label, value });
  }
  return out;
}
