'use client';
import { memo, useMemo } from 'react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, Legend, Tooltip, ResponsiveContainer,
} from 'recharts';
import { getColorForValue } from '@/shared/lib/utils/metric-colors';
import type { ChartComponentProps } from '../model/types';
import { useThresholdGrouping } from '@/shared/lib/hooks/use-threshold-grouping';
import { autoRadarDomain } from '@/shared/lib/utils/chart-domain';
import { formatRu } from '@/shared/lib/utils/format';

const COLORS = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

export const RadarChartView = memo(function RadarChartView({
  data, activeMetricIds, metricNames, axisColor, virtualMetrics,
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
        {groupedThresholds.map((group, gi) => {
          const thresholdKey = `__threshold_${gi}`;
          return (
            <Radar
              key={`threshold-${gi}`}
              name={`Порог: ${formatRu(group.y)}`}
              dataKey={thresholdKey}
              stroke={group.primaryColor}
              strokeWidth={group.isOverlap ? 2.5 : 2}
              strokeDasharray={group.isOverlap ? '4 2 1 2' : '6 3'}
              fill={group.primaryColor}
              fillOpacity={0.04}
              isAnimationActive={false}
              legendType="none"
              dot={false}
              opacity={0.85}
            />
          );
        })}
        {activeMetricIds.map((metricId, index) => {
          const vm = virtualMetrics.find(v => v.id === metricId);
          const rules = vm?.colorConfig?.rules;
          const color = COLORS[index % COLORS.length];
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
                const conditionalColor = getColorForValue(numericValue, rules, vm?.displayFormat);
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
            const filtered = payload.filter((p) => {
              const key = String(p.dataKey);
              return !key.startsWith('__threshold_');
            });
            if (filtered.length === 0) return null;
            return (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-lg shadow-xl text-sm">
                <p className="font-bold text-slate-900 dark:text-white mb-2">{label}</p>
                {filtered.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: entry.color ?? '#6366f1' }}
                    />
                    <span className="text-slate-500 dark:text-slate-400 text-xs">
                      {metricNames[String(entry.dataKey)]}:
                    </span>
                    <span className="font-mono font-medium text-slate-900 dark:text-slate-200 ml-auto">
                      {typeof entry.value === 'number'
                        ? formatRu(entry.value)
                        : String(entry.value ?? '—')}
                    </span>
                  </div>
                ))}
              </div>
            );
          }}
        />
        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
      </RadarChart>
    </ResponsiveContainer>
  );
});