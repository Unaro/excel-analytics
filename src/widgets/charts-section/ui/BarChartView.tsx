'use client';
import { memo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Rectangle,
} from 'recharts';
import { formatCompactNumber } from '@/shared/lib/utils/format';
import { getColorForValue, formatDisplayValue } from '@/shared/lib/utils/metric-colors';
import { useThresholdGrouping } from '@/shared/lib/hooks/use-threshold-grouping';
import { renderThresholdReferenceLines } from '@/shared/ui/threshold-marker';
import { ChartTooltip } from '@/shared/ui/chart-tooltip';
import type { ChartComponentProps } from '../model/types';
import type { CustomBarShapeProps } from '@/shared/lib/types/recharts';
import { METRIC_SERIES_COLORS } from '@/shared/lib/utils/chart-palette';

export const BarChartView = memo(function BarChartView({
  data, activeMetricIds, metricNames, axisColor, virtualMetrics,
  palette = METRIC_SERIES_COLORS,
}: ChartComponentProps) {
  const { groupedThresholds } = useThresholdGrouping(virtualMetrics, activeMetricIds);

  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={300} minHeight={300}>
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
          content={(props) => {
            const { active, payload, label } = props;
            if (!active || !payload?.length) return null;
            const rows = payload
              .filter((p) => !String(p.dataKey).startsWith('__threshold_'))
              .map((entry) => {
                const vm = virtualMetrics.find(v => v.id === entry.dataKey);
                return {
                  color: entry.color ?? '#6366f1',
                  name: metricNames[String(entry.dataKey)],
                  value: typeof entry.value === 'number'
                    ? formatDisplayValue(entry.value, vm?.displayFormat, vm?.unit)
                    : String(entry.value ?? '—'),
                };
              });
            return <ChartTooltip title={label} rows={rows} />;
          }}
          cursor={{ fill: 'var(--tooltip-cursor, rgba(0,0,0,0.05))', opacity: 0.1 }}
        />
        {renderThresholdReferenceLines(groupedThresholds)}
        {activeMetricIds.map((metricId, index) => {
          const vm = virtualMetrics.find(v => v.id === metricId);
          const rules = vm?.colorConfig?.rules;
          const defaultColor = palette[index % palette.length];
          return (
            <Bar
              key={metricId}
              dataKey={metricId}
              name={metricNames[metricId]}
              fill={defaultColor}
              radius={[4, 4, 0, 0]}
              isAnimationActive={true}
              animationDuration={800}
              shape={(props: CustomBarShapeProps) => {
                const { x = 0, y = 0, width = 0, height = 0, value, fill } = props;
                const numericValue = typeof value === 'number' ? value : null;
                // value уже в масштабе отображения — формат НЕ передаём (двойной ×100).
                const conditionalColor = getColorForValue(numericValue, rules);
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