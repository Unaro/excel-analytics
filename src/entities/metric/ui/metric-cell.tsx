'use client';

import { cn } from "@/shared/lib/utils";
import { COLOR_STYLES, checkRule, toDisplayScale } from "@/shared/lib/utils/metric-colors";
import { formatValue } from "@/shared/lib/computation/lib/utils";
import { VirtualMetric } from "@/shared/lib/validators";

interface MetricCellProps {
  value: number | null;
  formattedValue: string;
  metric: VirtualMetric;
}

export function MetricCell({ value, formattedValue, metric }: MetricCellProps) {

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

  return <span className={className}>{displayValue}</span>;
}