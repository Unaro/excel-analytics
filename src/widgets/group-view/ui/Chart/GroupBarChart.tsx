'use client';
import { memo, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Rectangle, ReferenceLine, Label,
} from 'recharts';
import { Card } from '@/shared/ui/card';
import { ScrollableChart } from '@/shared/ui/scrollable-chart';
import type { VirtualMetric } from '@/shared/lib/validators';
import { getColorForValue } from '@/shared/lib/utils/metric-colors';
import { formatCompactNumber, formatRu } from '@/shared/lib/utils/format';
import { groupThresholdsByValue } from '@/shared/lib/utils/thresholds';
import { ThresholdLabel } from '@/shared/ui/threshold-marker';
import type { CustomBarShapeProps } from '@/shared/lib/types/recharts';

const COLORS = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

interface GroupBarChartProps {
  data: Array<{ name: string; [key: string]: string | number }>;
  metricKeys: string[];
  metricNames: Record<string, string>;
  title: string;
  metricConfigs?: VirtualMetric[];
  /** Код → имя (словарь): для подписей оси/тултипа. Позиция — по сырому name. */
  resolveLabel?: (label: string) => string;
}

export const GroupBarChart = memo(function GroupBarChart({
  data,
  metricKeys,
  metricNames,
  title,
  metricConfigs,
  resolveLabel,
}: GroupBarChartProps) {
  const displayLabel = (v: unknown) =>
    resolveLabel ? resolveLabel(String(v)) : String(v);
  const groupedThresholds = useMemo(
    () => groupThresholdsByValue(metricConfigs || [], metricKeys),
    [metricConfigs, metricKeys]
  );

  if (data.length === 0) return null;

  return (
    <Card className="p-6">
      <h3 className="font-bold text-slate-900 dark:text-white mb-4">{title}</h3>
      <ScrollableChart
        slotCount={data.length}
        slotWidth={Math.max(48, metricKeys.length * 28)}
        height={400}
      >
          <BarChart data={data} margin={{ top: 20, left: 20, right: 60, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} vertical={false} />
            <XAxis
              dataKey="name"
              tickFormatter={displayLabel}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(val: number) => formatCompactNumber(val)}
            />
            <Tooltip
              content={(props) => {
                const { active, payload, label } = props;
                if (!active || !payload || !payload.length) return null;
                return (
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded shadow-xl text-xs">
                    <div className="font-bold text-slate-900 dark:text-white mb-2">{displayLabel(label)}</div>
                    {payload.map((entry, i) => (
                      <div key={i} className="flex justify-between gap-3">
                        <span style={{ color: entry.color ?? '#6366f1' }}>
                          {metricNames[String(entry.dataKey)]}
                        </span>
                        <span className="font-mono font-bold">
                          {typeof entry.value === 'number'
                            ? formatRu(entry.value)
                            : String(entry.value ?? '—')}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              }}
              cursor={{ fill: 'var(--tooltip-cursor)', opacity: 0.1 }}
            />
            {groupedThresholds.map((group, gi) => (
              <ReferenceLine
                key={`threshold-${gi}`}
                y={group.y}
                stroke={group.primaryColor}
                strokeDasharray={group.isOverlap ? '4 2 1 2' : '6 3'}
                strokeWidth={group.isOverlap ? 2 : 1.5}
                opacity={0.7}
                ifOverflow="extendDomain"
              >
                <Label
                  content={(props) => (
                    <ThresholdLabel
                      viewBox={props.viewBox as { x: number; y: number; width: number; height: number }}
                      value={group.labelValue}
                      group={group}
                    />
                  )}
                />
              </ReferenceLine>
            ))}
            {metricKeys.map((key, idx) => {
              const vm = metricConfigs?.find((v) => v.id === key);
              const rules = vm?.colorConfig?.rules;
              const defaultColor = COLORS[idx % COLORS.length];
              return (
                <Bar
                  key={key}
                  dataKey={key}
                  name={metricNames[key]}
                  fill={defaultColor}
                  radius={[4, 4, 0, 0]}
                  barSize={20}
                  isAnimationActive={true}
                  animationDuration={800}
                  shape={(props: CustomBarShapeProps) => {
                    const { x = 0, y = 0, width = 0, height = 0, value, fill } = props;
                    const numericValue = typeof value === 'number' ? value : null;
                    const conditionalColor = getColorForValue(numericValue, rules, vm?.displayFormat);
                    const finalFill = conditionalColor || fill || defaultColor;
                    return (
                      <Rectangle
                        x={x}
                        y={y}
                        width={width}
                        height={height}
                        fill={finalFill}
                        radius={[4, 4, 0, 0]}
                      />
                    );
                  }}
                />
              );
            })}
          </BarChart>
      </ScrollableChart>
    </Card>
  );
});