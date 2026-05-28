'use client';
import { memo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Rectangle,
} from 'recharts';
import { Card } from '@/shared/ui/card';

const COLORS = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

interface GroupBarChartProps {
  data: Array<{ name: string; [key: string]: string | number }>;
  metricKeys: string[];
  metricNames: Record<string, string>;
  title: string;
}

export const GroupBarChart = memo(function GroupBarChart({
  data,
  metricKeys,
  metricNames,
  title,
}: GroupBarChartProps) {
  if (data.length === 0) return null;

  return (
    <Card className="p-6">
      <h3 className="font-bold text-slate-900 dark:text-white mb-4">{title}</h3>
      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 20, right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
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
            />
            {metricKeys.map((key, idx) => (
              <Bar
                key={key}
                dataKey={key}
                name={metricNames[key]}
                fill={COLORS[idx % COLORS.length]}
                radius={[4, 4, 0, 0]}
                barSize={20}
                shape={(props: any) => (
                  <Rectangle
                    x={props.x}
                    y={props.y}
                    width={props.width}
                    height={props.height}
                    fill={props.fill}
                    radius={[4, 4, 0, 0]}
                  />
                )}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
});