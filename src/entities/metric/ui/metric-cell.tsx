'use client';

import { cn } from "@/shared/lib/utils";
import { COLOR_STYLES, checkRule, toDisplayScale } from "@/shared/lib/utils/metric-colors";
import { formatValue } from "@/shared/lib/computation/lib/utils";
import { VirtualMetric } from "@/shared/lib/validators";

interface MetricCellProps {
  value: number | null;
  formattedValue: string;
  metric: VirtualMetric;
  /** Значение введено из узла файла-агрегата — подсвечиваем ячейку. */
  fromNode?: boolean;
}

export function MetricCell({ value, formattedValue, metric, fromNode }: MetricCellProps) {

  const displayValue = formattedValue !== undefined && formattedValue !== '—'
    ? formattedValue
    : formatValue(value, metric.displayFormat, metric.decimalPlaces, metric.unit);

  if (displayValue === '—') {
    return <span className="text-slate-300 dark:text-slate-600 select-none">−</span>;
  }

  let className = "font-mono font-medium text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md transition-colors";
  const rules = metric.colorConfig?.rules || [];
  // Порог сравнивается в масштабе отображения (для percent — в процентах)
  const scaled = toDisplayScale(value ?? 0, metric.displayFormat);
  const activeRule = rules.find(rule => checkRule(scaled, rule.operator, rule.value, rule.value2));

  if (activeRule) {
    className = cn(className, COLOR_STYLES[activeRule.color]);
  }

  const valueSpan = <span className={className}>{displayValue}</span>;
  if (!fromNode) return valueSpan;

  // Подсветка «значение из узла файла»: пунктир снизу + точка-индикатор.
  return (
    <span
      className="inline-flex items-center gap-1 border-b border-dotted border-amber-400/80"
      title="Значение введено в файле (узел агрегата), а не рассчитано по строкам"
    >
      {valueSpan}
      <span className="text-amber-500 leading-none text-[10px]" aria-hidden>●</span>
    </span>
  );
}