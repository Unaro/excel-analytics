'use client';

import { memo, useMemo } from 'react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, Legend, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Card } from '@/shared/ui/card';
import { getColorForValue } from '@/shared/lib/utils/metric-colors';
import type { VirtualMetric } from '@/shared/lib/validators';
import { groupThresholdsByValue } from '@/shared/lib/utils/thresholds';

const COLORS = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

interface GroupRadarChartProps {
  data: Array<{ name: string; [key: string]: string | number }>;
  metricKeys: string[];
  metricNames: Record<string, string>;
  title: string;
  metricConfigs?: VirtualMetric[];
}

export const GroupRadarChart = memo(function GroupRadarChart({
  data,
  metricKeys,
  metricNames,
  title,
  metricConfigs,
}: GroupRadarChartProps) {
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
          <RadarChart data={data} cx="50%" cy="50%" outerRadius="75%">
            <PolarGrid stroke="#94a3b8" strokeOpacity={0.3} />
            <PolarAngleAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
            />
            <PolarRadiusAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />

            {groupedThresholds.map((group, gi) => {
              const thresholdKey = `__threshold_${gi}`;
              return (
                <Radar
                  key={`threshold-${gi}`}
                  name={`Порог: ${group.y.toLocaleString('ru-RU')}`}
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

            {metricKeys.map((key, idx) => {
              const vm = metricConfigs?.find(v => v.id === key);
              const rules = vm?.colorConfig?.rules;
              const defaultColor = COLORS[idx % COLORS.length];

              return (
                <Radar
                  key={key}
                  name={metricNames[key]}
                  dataKey={key}
                  stroke={defaultColor}
                  fill={defaultColor}
                  fillOpacity={0.3}
                  isAnimationActive={true}
                  dot={(props: any) => {
                    const { cx, cy, payload } = props;
                    const value = payload?.[key];
                    const conditionalColor = getColorForValue(
                      typeof value === 'number' ? value : null,
                      rules
                    );
                    const isHighlighted = !!conditionalColor;

                    return (
                      <circle
                        key={`dot-${key}-${cx}-${cy}`}
                        cx={cx}
                        cy={cy}
                        r={isHighlighted ? 6 : 3}
                        fill={conditionalColor || defaultColor}
                        stroke="#fff"
                        strokeWidth={isHighlighted ? 2 : 1}
                      />
                    );
                  }}
                />
              );
            })}

            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />

            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;

                const filtered = payload.filter((p: any) => {
                  const key = String(p.dataKey);
                  return !key.startsWith('__threshold_');
                });

                if (filtered.length === 0) return null;

                return (
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded shadow-xl text-xs">
                    <div className="font-bold text-slate-900 dark:text-white mb-2">{label}</div>
                    {filtered.map((entry: any, i: number) => (
                      <div key={i} className="flex justify-between gap-3">
                        <span style={{ color: entry.color }}>
                          {metricNames[entry.dataKey as string]}
                        </span>
                        <span className="font-mono font-bold">
                          {entry.value?.toLocaleString('ru-RU')}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
});