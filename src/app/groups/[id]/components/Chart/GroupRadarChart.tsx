'use client';
import { memo } from 'react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, Legend, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Card } from '@/shared/ui/card';

const COLORS = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

interface GroupRadarChartProps {
  data: Array<{ name: string; [key: string]: string | number }>;
  metricKeys: string[];
  metricNames: Record<string, string>;
  title: string;
}

export const GroupRadarChart = memo(function GroupRadarChart({
  data, metricKeys, metricNames, title,
}: GroupRadarChartProps) {
  if (data.length === 0) return null;

  return (
    <Card className="p-6">
      <h3 className="font-bold text-slate-900 dark:text-white mb-4">{title}</h3>
      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data}>
            <PolarGrid stroke="#94a3b8" strokeOpacity={0.3} />
            <PolarAngleAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
            />
            <PolarRadiusAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
            {metricKeys.map((key, idx) => (
              <Radar
                key={key}
                name={metricNames[key]}
                dataKey={key}
                stroke={COLORS[idx % COLORS.length]}
                fill={COLORS[idx % COLORS.length]}
                fillOpacity={0.3}
              />
            ))}
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                return (
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded shadow-xl text-xs">
                    <div className="font-bold text-slate-900 dark:text-white mb-2">{label}</div>
                    {payload.map((entry, i: number) => (
                      <div key={i} className="flex justify-between gap-3">
                        <span style={{ color: entry.color }}>{metricNames[entry.dataKey as string]}</span>
                        <span className="font-mono font-bold">{entry.value?.toLocaleString('ru-RU')}</span>
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