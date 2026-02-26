'use client';

import { cn } from "@/shared/lib/utils";
import { VirtualMetric } from "@/entities/dashboard";
import { COLOR_STYLES, checkRule } from "@/shared/lib/utils/metric-colors";

interface MetricCellProps {
  value: number | null;
  formattedValue: string;
  metric: VirtualMetric;
}

export function MetricCell({ value, formattedValue, metric }: MetricCellProps) {
  if (value === null) {
    return <span className="text-slate-300 select-none">−</span>;
  }

  // Базовый стиль
  let className = "font-mono font-medium text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md transition-colors";
  
  // Ищем первое сработавшее правило
  const rules = metric.colorConfig?.rules || [];
  
  // Array.find вернет первое правило, условие которого true
  const activeRule = rules.find(rule => checkRule(value, rule.operator, rule.value, rule.value2));

  if (activeRule) {
    // Если правило найдено, добавляем классы цвета
    className = cn(className, COLOR_STYLES[activeRule.color]);
  } else {
    // Если правил нет или ни одно не сработало — фон прозрачный
    className = cn(className, "bg-transparent");
  }

  return (
    <span className={className}>
      {formattedValue}
    </span>
  );
}