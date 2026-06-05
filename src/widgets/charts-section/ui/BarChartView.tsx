'use client';

import { memo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Label, Rectangle,
} from 'recharts';
import { formatCompactNumber } from '@/shared/lib/utils/format';
import { getColorForValue } from '@/shared/lib/utils/metric-colors';
import { useThresholdGrouping } from '@/shared/lib/hooks/use-threshold-grouping';
import { ThresholdLabel } from '@/shared/ui/threshold-marker';
import type { ChartComponentProps } from '../model/types';

const COLORS = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

export const BarChartView = memo(function BarChartView({
  data, activeMetricIds, metricNames, axisColor, virtualMetrics,
}: ChartComponentProps) {
  const { groupedThresholds } = useThresholdGrouping(virtualMetrics, activeMetricIds);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 20, right: 60, left: 20, bottom: 70 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={axisColor} strokeOpacity={0.2} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10, fill: axisColor }}
          axisLine={false}
          tickLine={false}
          angle={-13}
          textAnchor="middle"
          interval={0}
          height={60}
        />
        <YAxis
          tick={{ fontSize: 10, fill: axisColor }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(val: number) => formatCompactNumber(val)}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const filtered = payload.filter(p => {
              const key = String(p.dataKey);
              return !key.startsWith('__threshold_');
            });
            return (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-lg shadow-xl text-sm">
                <p className="font-bold text-slate-900 dark:text-white mb-2">{label}</p>
                {filtered.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-slate-500 dark:text-slate-400 text-xs">
                      {metricNames[entry.dataKey as string]}:
                    </span>
                    <span className="font-mono font-medium text-slate-900 dark:text-slate-200 ml-auto">
                      {entry.value?.toLocaleString('ru-RU')}
                    </span>
                  </div>
                ))}
              </div>
            );
          }}
          cursor={{ fill: 'var(--tooltip-cursor, rgba(0,0,0,0.05))', opacity: 0.1 }}
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
        {activeMetricIds.map((metricId, index) => {
          const vm = virtualMetrics.find(v => v.id === metricId);
          const rules = vm?.colorConfig?.rules;
          const defaultColor = COLORS[index % COLORS.length];
          return (
            <Bar
              key={metricId}
              dataKey={metricId}
              name={metricNames[metricId]}
              fill={defaultColor}
              radius={[4, 4, 0, 0]}
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
                    x={x} y={y} width={width} height={height}
                    fill={finalFill}
                    radius={[4, 4, 0, 0]}
                  />
                );
              }}
            />
          );
        })}
        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
      </BarChart>
    </ResponsiveContainer>
  );
});