import { ConditionOperator } from "@/shared/ui/rule-card";
import { FormattingRule } from "./formatting-rules";

export const COLOR_STYLES: Record<MetricColor, string> = {
  emerald: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20",
  rose:    "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20",
  amber:   "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20",
  blue:    "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20",
  indigo:  "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20",
  slate:   "text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800",
};

export const METRIC_COLOR_HEX: Record<MetricColor, string> = {
  emerald: '#10b981',
  rose:    '#f43f5e',
  amber:   '#f59e0b',
  blue:    '#3b82f6',
  indigo:  '#6366f1',
  slate:   '#94a3b8',
};

/**
 * Приводит сырое значение к масштабу, в котором оно ОТОБРАЖАЕТСЯ.
 *
 * Условное форматирование и пороговые линии сравнивают значение в том же
 * виде, что видит пользователь: для формата `percent` (доля → %) значение
 * умножается на 100, поэтому порог `>50` срабатывает на «56.87%».
 * Для `percent_raw` (готовый процент) и остальных форматов масштаб
 * совпадает с сырым значением.
 */
export function toDisplayScale(value: number, format?: string): number {
  return format === 'percent' ? value * 100 : value;
}

/**
 * Форматирует УЖЕ масштабированное (display) значение для подписи на чарте.
 * `percent`/`percent_raw` → «N%» (значение уже в процентах после toDisplayScale),
 * остальные форматы → число ru-RU с опциональной единицей измерения.
 */
export function formatDisplayValue(displayValue: number, format?: string, unit?: string): string {
  const num = displayValue.toLocaleString('ru-RU');
  if (format === 'percent' || format === 'percent_raw') return `${num}%`;
  return unit ? `${num} ${unit}` : num;
}

/**
 * Проверяет значение против оператора правила условного форматирования.
 * `between` — включающий диапазон [threshold, threshold2].
 */
export function checkRule(value: number, operator: ConditionOperator, threshold: number, threshold2?: number): boolean {
  switch (operator) {
    case '>': return value > threshold;
    case '>=': return value >= threshold;
    case '<': return value < threshold;
    case '<=': return value <= threshold;
    case '==': return value === threshold;
    case '!=': return value !== threshold;
    case 'between': {
      // Границы нормализуются: правило работает и при «перепутанных»
      // min/max (пользователь ввёл 10..5)
      const lo = Math.min(threshold, threshold2 ?? threshold);
      const hi = Math.max(threshold, threshold2 ?? threshold);
      return value >= lo && value <= hi;
    }
    default: return false;
  }
}

/**
 * Возвращает HEX-цвет первого совпавшего правила, или null.
 *
 * Правила применяются СВЕРХУ ВНИЗ по массиву (первое совпавшее "побеждает").
 *
 * Переиспользуется в:
 *  - widgets/ChartsSection (дашборд: бары, точки радара)
 *  - app/groups/[id]/Chart (группы: бары, точки радара)
 */
export function getColorForValue(
  value: number | null | undefined,
  rules: FormattingRule[] | undefined,
  format?: string
): string | null {
  if (value == null || !rules || rules.length === 0) return null;
  // Сравнение в масштабе отображения: порог задаётся так, как видит
  // пользователь (для percent — в процентах, а не в доле).
  const scaled = toDisplayScale(value, format);
  for (const rule of rules) {
    if (checkRule(scaled, rule.operator, rule.value, rule.value2)) {
      return METRIC_COLOR_HEX[rule.color] || null;
    }
  }
  return null;
}

export type MetricColor = 'emerald' | 'rose' | 'amber' | 'blue' | 'indigo' | 'slate';