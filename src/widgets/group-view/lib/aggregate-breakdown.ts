// Пер-категорийная агрегация 2-D-разбивки: из ячеек (категория × вторая ось)
// собирает по одному синтетическому элементу на КАТЕГОРИЮ с корректным итогом
// каждой метрики — простые суммируются, расчётные считаются формулой на суммах
// операндов (Σa/Σb). Используется для условий отображения в 2-D (фильтр строк
// по итогу). Чистая функция — тестируется отдельно.

import type { BreakdownItem } from '@/entities/metric';
import type { VirtualMetricValue } from '@/shared/lib/types/computation';
import { metricValueOf, evalCalcRowTotal, type MetricCalcSpec } from '@/shared/ui/time-breakdown/pivot';

export function aggregateByLabel(
  items: BreakdownItem[],
  calcSpecByVmId: Record<string, MetricCalcSpec>
): BreakdownItem[] {
  // Группировка ячеек по категории (label).
  const byLabel = new Map<string, BreakdownItem[]>();
  for (const item of items) {
    const list = byLabel.get(item.label);
    if (list) list.push(item);
    else byLabel.set(item.label, [item]);
  }

  const out: BreakdownItem[] = [];
  for (const [label, cells] of byLabel) {
    // Набор метрик берём из первой ячейки (во всех ячейках он одинаков).
    const metricMetas = cells[0]?.virtualMetrics ?? [];
    const virtualMetrics: VirtualMetricValue[] = metricMetas.map((meta) => {
      const id = meta.virtualMetricId;
      const spec = calcSpecByVmId[id];
      let total: number | null;
      if (spec) {
        total = evalCalcRowTotal(cells, spec);
      } else {
        let sum = 0;
        let any = false;
        for (const c of cells) {
          const v = metricValueOf(c, id);
          if (v !== null) { sum += v; any = true; }
        }
        total = any ? sum : null;
      }
      return {
        virtualMetricId: id,
        virtualMetricName: meta.virtualMetricName,
        value: total,
        formattedValue: total === null ? '—' : String(total),
        sourceMetricId: meta.sourceMetricId,
      };
    });
    const recordCount = cells.reduce((s, c) => s + (c.recordCount ?? 0), 0);
    out.push({ label, recordCount, virtualMetrics });
  }
  return out;
}
