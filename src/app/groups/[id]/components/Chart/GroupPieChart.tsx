'use client';
import { memo } from 'react';
import { PieChart, Pie, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card } from '@/shared/ui/card';

const COLORS = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#14b8a6'];

interface GroupPieChartProps {
  data: Array<{ name: string; value: number }>;
  title: string;
  metricName: string;
}

export const GroupPieChart = memo(function GroupPieChart({
  data,
  title,
  metricName,
}: GroupPieChartProps) {
  if (data.length === 0) return null;

  // Берём ТОП-10, остальные — "Прочее"
  const topData = data.slice(0, 10);
  const othersSum = data.slice(10).reduce((sum, item) => sum + item.value, 0);
  
  // Добавляем цвет в данные
  const finalData = (othersSum > 0
    ? [...topData, { name: 'Прочее', value: othersSum }]
    : topData
  ).map((item, index) => ({
    ...item,
    fill: COLORS[index % COLORS.length],
  }));

  return (
    <Card className="p-6">
      <h3 className="font-bold text-slate-900 dark:text-white mb-4">
        {title} <span className="text-indigo-600 dark:text-indigo-400 text-sm font-normal">· {metricName}</span>
      </h3>
      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={finalData}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={130}
              dataKey="value"
              label={({ name, percent }) =>
                percent && percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ''
              }
              isAnimationActive={true}
              animationDuration={800}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                return (
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded shadow-xl text-xs">
                    <div className="font-bold text-slate-900 dark:text-white">{payload[0].name}</div>
                    <div className="text-slate-500 mt-1 font-mono">
                      {(payload[0].value as number).toLocaleString('ru-RU')}
                    </div>
                  </div>
                );
              }}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
});