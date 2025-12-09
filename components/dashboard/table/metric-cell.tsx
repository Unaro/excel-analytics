'use client';

import { cn } from "@/lib/utils";
import { VirtualMetric } from "@/types/dashboards";

interface MetricCellProps {
  value: number | null;
  formattedValue: string;
  metric: VirtualMetric;
}

export function MetricCell({ value, formattedValue, metric }: MetricCellProps) {
  // Если значения нет (null), рисуем прочерк
  if (value === null) {
    return <span className="text-slate-300 dark:text-slate-700 text-xl leading-none select-none">−</span>;
  }

  const config = metric.colorConfig;
  
  // Базовые стили шрифта
  let className = "font-mono font-medium text-slate-700 dark:text-slate-300 tracking-tight";

  // Логика раскрашивания
  if (config?.mode === 'positive_negative') {
    const isPositive = value > 0;
    const isNegative = value < 0;
    const isInverse = config.isInverse;

    if (isPositive) {
      // Зеленый (или красный, если инверсия)
      className = cn(className, isInverse ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400");
    } else if (isNegative) {
      // Красный (или зеленый, если инверсия)
      className = cn(className, isInverse ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400");
    } else {
      // Ноль — серый
      className = cn(className, "text-slate-400");
    }
  }

  return (
    <span className={className}>
      {formattedValue}
    </span>
  );
}