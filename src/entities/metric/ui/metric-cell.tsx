'use client';

import { cn } from "@/shared/lib/utils";
import { COLOR_STYLES, checkRule } from "@/shared/lib/utils/metric-colors";
import { VirtualMetric } from "@/shared/lib/validators";

interface MetricCellProps {
  value: number | null;
  formattedValue: string;
  metric: VirtualMetric;
}

export function MetricCell({ value, formattedValue, metric }: MetricCellProps) {

  const displayValue = formattedValue !== undefined && formattedValue !== '—'
    ? formattedValue
    : formatFallback(value, metric.displayFormat, metric.decimalPlaces, metric.unit);

  if (displayValue === '—') {
    return <span className="text-slate-300 dark:text-slate-600 select-none">−</span>;
  }

  let className = "font-mono font-medium text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md transition-colors";
  const rules = metric.colorConfig?.rules || [];
  const activeRule = rules.find(rule => checkRule(value ?? 0, rule.operator, rule.value, rule.value2));
  
  if (activeRule) {
    className = cn(className, COLOR_STYLES[activeRule.color]);
  }

  return <span className={className}>{displayValue}</span>;
}

function formatFallback(val: number | null, format: string, decimals: number, unit?: string): string {
  if (val === null) return '—';
  const round = (n: number, d: number) => Math.round((n + Number.EPSILON) * 10 ** d) / 10 ** d;
  
  switch (format) {
    case 'percent': return `${round(val * 100, decimals)}%`;
    case 'currency':
    case 'decimal':
      return round(val, decimals).toLocaleString('ru-RU', { maximumFractionDigits: decimals }) + (unit ? ` ${unit}` : '');
    default: return round(val, decimals).toLocaleString('ru-RU', { maximumFractionDigits: decimals });
  }
}