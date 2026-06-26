// Фильтр элементов разбивки по условиям отображения группы (правила по метрике).
// Хранится на группе (IndicatorGroup.displayFilters), применяется к таблице и
// чартам — чтобы большие уровни (100+ элементов) показывать управляемо.

import type { BreakdownItem } from '@/entities/metric';
import type { DisplayFilterRule } from '@/shared/lib/validators';
import { checkRule, toDisplayScale } from '@/shared/lib/utils/metric-colors';

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
      return checkRule(scaled, rule.operator, rule.value, rule.value2);
    });
  });
}
