'use client';

import { memo, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Rectangle, ReferenceLine, Label,
} from 'recharts';
import { Card } from '@/shared/ui/card';
import type { VirtualMetric } from '@/shared/lib/validators';
import { getColorForValue } from '@/shared/lib/utils/metric-colors';
import { formatCompactNumber } from '@/shared/lib/utils/format';
import { groupThresholdsByValue } from '@/shared/lib/utils/thresholds';
import { ThresholdLabel } from '@/shared/ui/threshold-marker';

const COLORS = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

interface GroupBarChartProps {
  data: Array<{ name: string; [key: string]: string | number }>;
  metricKeys: string[];
  metricNames: Record<string, string>;
  title: string;
  metricConfigs?: VirtualMetric[];
}

export const GroupBarChart = memo(function GroupBarChart({
  data,
  metricKeys,
  metricNames,
  title,
  metricConfigs,
}: GroupBarChartProps) {
  const groupedThresholds = useMemo(
    () => groupThresholdsByValue(metricConfigs || [], metricKeys),
    [metricConfigs, metricKeys]
  );

  if (data.length === 0) return null;

  return (
    <Card className="p-6">
      <h3 className="font-bold text-slate-900 dark:text-white mb-4">{title}</h3>
      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, left: 20, right: 60, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} vertical={false} />

            <XAxis
              dataKey="name"
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
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                return (
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded shadow-xl text-xs">
                    <div className="font-bold text-slate-900 dark:text-white mb-2">{label}</div>
                    {payload.map((entry: any, i: number) => (
                      <div key={i} className="flex justify-between gap-3">
                        <span style={{ color: entry.color }}>{metricNames[entry.dataKey]}</span>
                        <span className="font-mono font-bold">{entry.value?.toLocaleString('ru-RU')}</span>
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
                      value={group.y}
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
                  shape={(props: any) => {
                    const { x, y, width, height, value, fill } = props;
                    const conditionalColor = getColorForValue(
                      typeof value === 'number' ? value : null,
                      rules
                    );
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
        </ResponsiveContainer>
      </div>
    </Card>
  );
});