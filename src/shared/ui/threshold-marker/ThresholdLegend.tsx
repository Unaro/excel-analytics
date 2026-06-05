'use client';
import { memo } from 'react';
import type { GroupedThreshold } from '@/shared/lib/utils/thresholds';
import type { VirtualMetric } from '@/shared/lib/validators';
import { useThresholdGrouping } from '@/features/charts-thresholds';

interface ThresholdLegendProps {
  virtualMetrics: VirtualMetric[];
  activeMetricIds: string[];
}

function getOperatorLabel(op: string): string {
  switch (op) {
    case '>': return '>';
    case '>=': return '≥';
    case '<': return '<';
    case '<=': return '≤';
    case '==': return '=';
    case '!=': return '≠';
    case 'between': return '↔';
    default: return op;
  }
}

const LegendItem = memo(function LegendItem({ group }: { group: GroupedThreshold }) {
  const color = group.primaryColor;
  const firstRule = group.rules[0];
  const opLabel = getOperatorLabel(firstRule.rule.operator);
  const text =
    firstRule.rule.operator === 'between' && firstRule.rule.value2 != null
      ? `${firstRule.rule.value} – ${firstRule.rule.value2}`
      : `${opLabel} ${firstRule.rule.value}`;

  return (
    <div
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono border cursor-pointer transition-all hover:scale-105 hover:shadow-sm"
      style={{
        borderColor: `${color}60`,
        color,
        backgroundColor: `${color}12`,
      }}
      title={`${firstRule.metricName}: ${text}${group.isOverlap ? ` (+${group.rules.length - 1})` : ''}`}
    >
      <div
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="font-semibold truncate max-w-[100px]">
        {firstRule.metricName}:
      </span>
      <span className="font-medium">{text}</span>
      {group.isOverlap && (
        <span
          className="ml-1 px-1 py-0.5 rounded-full text-[8px] font-bold text-white"
          style={{ backgroundColor: color }}
        >
          +{group.rules.length - 1}
        </span>
      )}
    </div>
  );
});

export const ThresholdLegend = memo(function ThresholdLegend({
  virtualMetrics,
  activeMetricIds,
}: ThresholdLegendProps) {
  const { groupedThresholds } = useThresholdGrouping(virtualMetrics, activeMetricIds);

  if (groupedThresholds.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 px-1 py-1 mb-1">
      {groupedThresholds.map((group: GroupedThreshold, i: number) => (
        <LegendItem key={`legend-${i}`} group={group} />
      ))}
    </div>
  );
});