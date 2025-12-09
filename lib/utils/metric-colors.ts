import { MetricColor, ConditionOperator } from "@/types/dashboards";

// Маппинг цветов Tailwind
export const COLOR_STYLES: Record<MetricColor, string> = {
  emerald: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20",
  rose:    "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20",
  amber:   "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20",
  blue:    "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20",
  indigo:  "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20",
  slate:   "text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800",
};

// Функция проверки условия
export function checkRule(value: number, operator: ConditionOperator, threshold: number): boolean {
  switch (operator) {
    case '>': return value > threshold;
    case '>=': return value >= threshold;
    case '<': return value < threshold;
    case '<=': return value <= threshold;
    case '==': return value === threshold; // Внимание: строгое равенство для float может быть опасным, но оставим для целых
    case '!=': return value !== threshold;
    default: return false;
  }
}