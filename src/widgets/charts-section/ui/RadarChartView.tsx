'use client';
import { memo, useMemo } from 'react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, Legend, Tooltip, ResponsiveContainer,
} from 'recharts';
import { getColorForValue, formatDisplayValue } from '@/shared/lib/utils/metric-colors';
import type { ChartComponentProps } from '../model/types';
import { useThresholdGrouping } from '@/shared/lib/hooks/use-threshold-grouping';
import { autoRadarDomain } from '@/shared/lib/utils/chart-domain';
import { renderThresholdRadars } from '@/shared/ui/threshold-marker';
import { ChartTooltip } from '@/shared/ui/chart-tooltip';
import { METRIC_SERIES_COLORS } from '@/shared/lib/utils/chart-palette';

export const RadarChartView = memo(function RadarChartView({
  data, activeMetricIds, metricNames, axisColor, virtualMetrics,
  palette = METRIC_SERIES_COLORS,
}: ChartComponentProps) {
  const { groupedThresholds } = useThresholdGrouping(virtualMetrics, activeMetricIds);

  // Авто-домен по значениям метрик: малые величины (доли < 1) не схлопываются.
  const radarDomain = useMemo(() => {
    const vals: number[] = [];
    for (const row of data) {
      for (const key of activeMetricIds) {
        const v = (row as Record<string, unknown>)[key];
        if (typeof v === 'number') vals.push(v);
      }
    }
    return autoRadarDomain(vals);
  }, [data, activeMetricIds]);

  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={300} minHeight={300}>
      <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
        <PolarGrid stroke={axisColor} strokeOpacity={0.2} />
        <PolarAngleAxis dataKey="name" tick={{ fontSize: 10, fill: axisColor }} />
        <PolarRadiusAxis angle={30} domain={radarDomain} tick={false} axisLine={false} />
        {renderThresholdRadars(groupedThresholds)}
        {activeMetricIds.map((metricId, index) => {
          const vm = virtualMetrics.find(v => v.id === metricId);
          const rules = vm?.colorConfig?.rules;
          const color = palette[index % palette.length];
          return (
            <Radar
              key={metricId}
              name={metricNames[metricId]}
              dataKey={metricId}
              stroke={color}
              fill={color}
              fillOpacity={0.3}
              isAnimationActive={true}
              dot={(props) => {
                const { cx = 0, cy = 0, payload } = props;
                const rawValue = payload?.[metricId];
                const numericValue = typeof rawValue === 'number' ? rawValue : null;
                // payload уже в масштабе отображения — формат НЕ передаём.
                const conditionalColor = getColorForValue(numericValue, rules);
                const isHighlighted = !!conditionalColor;
                return (
                  <circle
                    key={`dot-${metricId}-${cx}-${cy}`}
                    cx={cx} cy={cy}
                    r={isHighlighted ? 6 : 3}
                    fill={conditionalColor || color}
                    stroke="#fff"
                    strokeWidth={isHighlighted ? 2 : 1}
                  />
                );
              }}
            />
          );
        })}
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
        />
        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
      </RadarChart>
    </ResponsiveContainer>
  );
});