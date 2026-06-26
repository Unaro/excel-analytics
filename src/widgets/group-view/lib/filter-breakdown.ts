// Фильтр элементов разбивки по условиям отображения группы (правила по метрике).
// Хранится на группе (IndicatorGroup.displayFilters), применяется к таблице и
// чартам — чтобы большие уровни (100+ элементов) показывать управляемо.

import type { BreakdownItem } from '@/entities/metric';
import type { DisplayFilterRule } from '@/shared/lib/validators';
import type { ConditionOperator } from '@/shared/ui/rule-card';
import { checkRule, toDisplayScale } from '@/shared/lib/utils/metric-colors';

/**
 * Сравнение двух значений метрик (метрика vs метрика) с допуском по float:
 * суммы по детям дают «99.99999 ≠ 100», поэтому == / != сравниваем с epsilon,
 * пропорциональным масштабу значений. `between` для метрики не задаётся (нет
 * второй границы) → трактуем как «≠».
 */
function compareMetricValues(a: number, op: ConditionOperator, b: number): boolean {
  const eps = Math.max(1, Math.abs(a), Math.abs(b)) * 1e-9;
  switch (op) {
    case '>': return a - b > eps;
    case '>=': return a - b > -eps;
    case '<': return b - a > eps;
    case '<=': return b - a > -eps;
    case '==': return Math.abs(a - b) <= eps;
    case '!=':
    case 'between': return Math.abs(a - b) > eps;
    default: return false;
  }
}

/**
 * Оставляет элементы разбивки, удовлетворяющие ВСЕМ правилам (AND). Сравнение —
 * в масштабе отображения (как пороги/CF): для percent порог в процентах.
 * Метрика без значения (null) правило НЕ проходит. Нет правил → элементы как есть.
 *
 * @param formatByMetricId metricId → displayFormat (для масштаба сравнения)
 */
export function filterBreakdownByRules(
  items: BreakdownItem[],
  rules: ReadonlyArray<DisplayFilterRule> | undefined,
  formatByMetricId: Record<string, string | undefined>
): BreakdownItem[] {
  if (!rules || rules.length === 0) return items;
  return items.filter((item) => {
    const byId = new Map(item.virtualMetrics.map((v) => [v.virtualMetricId, v]));
    return rules.every((rule) => {
      const vm = byId.get(rule.metricId);
      if (!vm || vm.value == null) return false;
      const scaled = toDisplayScale(vm.value, formatByMetricId[rule.metricId]);
      // Сравнение «метрика vs метрика» в той же строке.
      if (rule.compareMetricId) {
        const other = byId.get(rule.compareMetricId);
        if (!other || other.value == null) return false;
        const right = toDisplayScale(other.value, formatByMetricId[rule.compareMetricId]);
        return compareMetricValues(scaled, rule.operator, right);
      }
      return checkRule(scaled, rule.operator, rule.value, rule.value2);
    });
  });
}
