import { FormattingRule } from '@/entities/dashboard';
import { VirtualMetric } from '@/shared/lib/validators';

export interface GroupedThreshold {
  /** Значение Y для ReferenceLine (среднее по группе) */
  y: number;
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
 * - Правила с разницей < 0.5% от максимального значения объединяются
 */
export function groupThresholdsByValue(
  virtualMetrics: VirtualMetric[],
  activeMetricIds: string[],
  tolerancePercent: number = 0.5
): GroupedThreshold[] {
  // 1. Собираем все "точки" (y-значения) с привязкой к правилу
  interface ThresholdPoint {
    y: number;
    metricName: string;
    metricId: string;
    rule: FormattingRule;
  }

  const points: ThresholdPoint[] = [];

  for (const metricId of activeMetricIds) {
    const vm = virtualMetrics.find(v => v.id === metricId);
    if (!vm?.colorConfig?.rules) continue;

    for (const rule of vm.colorConfig.rules) {
      if (rule.operator === 'between' && rule.value2 != null) {
        // between создаёт ДВЕ линии (границы диапазона)
        points.push({ y: rule.value, metricName: vm.name, metricId, rule });
        points.push({ y: rule.value2, metricName: vm.name, metricId, rule });
      } else {
        points.push({ y: rule.value, metricName: vm.name, metricId, rule });
      }
    }
  }

  if (points.length === 0) return [];

  // 2. Сортируем по Y для корректной группировки
  points.sort((a, b) => a.y - b.y);

  // 3. Вычисляем "масштаб" для tolerance (на основе размаха значений)
  const minY = points[0].y;
  const maxY = points[points.length - 1].y;
  const range = Math.abs(maxY - minY);
  // Минимальный абсолютный допуск = 1 единица (чтобы не группировать 100 и 101)
  const absoluteTolerance = Math.max(range * (tolerancePercent / 100), 1);

  // 4. Группируем близкие точки
  const groups: GroupedThreshold[] = [];
  let currentGroup: ThresholdPoint[] = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const prev = currentGroup[currentGroup.length - 1];
    const curr = points[i];

    if (Math.abs(curr.y - prev.y) <= absoluteTolerance) {
      // Близкое значение — добавляем в текущую группу
      currentGroup.push(curr);
    } else {
      // Закрываем текущую группу и начинаем новую
      groups.push(buildGroup(currentGroup));
      currentGroup = [curr];
    }
  }
  // Не забываем последнюю группу
  groups.push(buildGroup(currentGroup));

  return groups;
}

function buildGroup(points: Array<{
  y: number;
  metricName: string;
  metricId: string;
  rule: any;
}>): GroupedThreshold {
  // Среднее Y для линии (чтобы линия была ровно посередине близких значений)
  const avgY = points.reduce((sum, p) => sum + p.y, 0) / points.length;

  // Убираем дубликаты (одно и то же правило одной метрики)
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
    rules,
    primaryColor,
    isOverlap: rules.length > 1,
  };
}