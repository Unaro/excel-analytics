import { VirtualMetric } from '@/shared/lib/validators';
import { FormattingRule } from './formatting-rules';

export interface GroupedThreshold {
  /**
   * Позиция ReferenceLine на оси (масштаб ПОСТРОЕНИЯ графика = сырые
   * значения). Для percent порог переводится из процентов в долю
   * (÷100), чтобы линия совпала с сырыми барами.
   */
  y: number;
  /** Значение для ПОДПИСИ (масштаб отображения — как ввёл пользователь). */
  labelValue: number;
  /** Все правила, попадающие в эту группу */
  rules: Array<{
    metricName: string;
    metricId: string;
    rule: FormattingRule;
  }>;
  /** Доминирующий цвет (первого правила в группе) */
  primaryColor: string;
  /** Является ли это "наложением" (2+ правил) */
  isOverlap: boolean;
}

/** Перевод порога из масштаба отображения в масштаб построения графика. */
function toPlotScale(value: number, format?: string): number {
  return format === 'percent' ? value / 100 : value;
}

const METRIC_COLOR_HEX: Record<string, string> = {
  emerald: '#10b981',
  rose:    '#f43f5e',
  amber:   '#f59e0b',
  blue:    '#3b82f6',
  indigo:  '#6366f1',
  slate:   '#94a3b8',
};

/**
 * Группирует пороговые правила по близким значениям Y.
 *
 * Логика:
 * - Для правила `between` создаём ДВЕ группы (min и max границы)
 * - Для остальных — одну группу
 * - Правила с разницей < tolerancePercent от размаха значений объединяются
 */
export function groupThresholdsByValue(
  virtualMetrics: VirtualMetric[],
  activeMetricIds: string[],
  tolerancePercent: number = 0.5
): GroupedThreshold[] {
  interface ThresholdPoint {
    /** Позиция на оси (масштаб построения). */
    y: number;
    /** Значение для подписи (масштаб отображения). */
    labelValue: number;
    metricName: string;
    metricId: string;
    rule: FormattingRule;
  }

  const points: ThresholdPoint[] = [];

  for (const metricId of activeMetricIds) {
    const vm = virtualMetrics.find(v => v.id === metricId);
    if (!vm?.colorConfig?.rules) continue;
    const fmt = vm.displayFormat;

    const pushPoint = (v: number, rule: FormattingRule) =>
      points.push({
        y: toPlotScale(v, fmt),
        labelValue: v,
        metricName: vm.name,
        metricId,
        rule,
      });

    for (const rule of vm.colorConfig.rules) {
      pushPoint(rule.value, rule);
      if (rule.operator === 'between' && rule.value2 != null) {
        pushPoint(rule.value2, rule);
      }
    }
  }

  if (points.length === 0) return [];

  points.sort((a, b) => a.y - b.y);

  const minY = points[0].y;
  const maxY = points[points.length - 1].y;
  const range = Math.abs(maxY - minY);
  // Допуск склейки — ТОЛЬКО относительный (доля от размаха). Прежний
  // floor Math.max(..., 1) был в масштабе построения: после перевода
  // percent в доли (0..1) единица схлопывала любые проценты в одну линию
  // (100% и 50% → 0.75). При range === 0 склеиваются лишь точно равные.
  const absoluteTolerance = range * (tolerancePercent / 100);

  const groups: GroupedThreshold[] = [];
  let currentGroup: ThresholdPoint[] = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const prev = currentGroup[currentGroup.length - 1];
    const curr = points[i];

    if (Math.abs(curr.y - prev.y) <= absoluteTolerance) {
      currentGroup.push(curr);
    } else {
      groups.push(buildGroup(currentGroup));
      currentGroup = [curr];
    }
  }

  groups.push(buildGroup(currentGroup));
  return groups;
}

function buildGroup(points: Array<{
  y: number;
  labelValue: number;
  metricName: string;
  metricId: string;
  rule: FormattingRule;
}>): GroupedThreshold {
  const avgY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  const avgLabel = points.reduce((sum, p) => sum + p.labelValue, 0) / points.length;

  const uniqueRules = new Map<string, GroupedThreshold['rules'][0]>();
  for (const p of points) {
    const key = `${p.metricId}:${p.rule.id}:${p.y}`;
    if (!uniqueRules.has(key)) {
      uniqueRules.set(key, {
        metricName: p.metricName,
        metricId: p.metricId,
        rule: p.rule,
      });
    }
  }

  const rules = Array.from(uniqueRules.values());
  const primaryColor = METRIC_COLOR_HEX[rules[0].rule.color] || '#94a3b8';

  return {
    y: avgY,
    labelValue: avgLabel,
    rules,
    primaryColor,
    isOverlap: rules.length > 1,
  };
}