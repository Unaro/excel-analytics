'use client';

import { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { DashboardComputationResult } from '@/types';
import { Card } from '@/components/ui/card';
import { BarChart3, PieChart, Hexagon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChartsSectionProps {
  result: DashboardComputationResult;
}

type ChartType = 'bar' | 'radar';

export function ChartsSection({ result }: ChartsSectionProps) {
  const [activeMetricId, setActiveMetricId] = useState<string>(
    result.virtualMetrics[0]?.id || ''
  );
  const [chartType, setChartType] = useState<ChartType>('bar');

  // 1. Подготовка данных для Recharts
  const chartData = useMemo(() => {
    if (!result || !activeMetricId) return [];

    return result.groups.map(group => {
      const metricValue = group.virtualMetrics.find(vm => vm.virtualMetricId === activeMetricId);
      return {
        name: group.groupName,
        value: metricValue?.value ?? 0,
        formatted: metricValue?.formattedValue ?? '—',
        fill: '#6366f1' // indigo-500
      };
    });
  }, [result, activeMetricId]);

  const activeMetric = result.virtualMetrics.find(m => m.id === activeMetricId);

  if (!result || result.groups.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* ЛЕВАЯ ЧАСТЬ: Управление и Легенда */}
      <Card className="p-5 lg:col-span-1 flex flex-col gap-6 h-full">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white mb-1">Визуализация</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Выберите показатель для построения графика по текущим группам.
          </p>
        </div>

        {/* Выбор типа графика */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-full">
          <button
            onClick={() => setChartType('bar')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-all",
              chartType === 'bar' ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm" : "text-slate-500 dark:text-slate-400"
            )}
          >
            <BarChart3 size={16} /> Сравнение
          </button>
          <button
            onClick={() => setChartType('radar')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-all",
              chartType === 'radar' ? "bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-300 shadow-sm" : "text-slate-500 dark:text-slate-400"
            )}
          >
            <Hexagon size={16} /> Профиль
          </button>
        </div>

        {/* Список метрик (Радио-кнопки) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2 max-h-[300px]">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Показатель (Ось Y)</div>
          {result.virtualMetrics.map(vm => (
            <button
              key={vm.id}
              onClick={() => setActiveMetricId(vm.id)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors border",
                activeMetricId === vm.id 
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300" 
                  : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              )}
            >
              {vm.name}
            </button>
          ))}
        </div>
      </Card>

      {/* ПРАВАЯ ЧАСТЬ: Сам График */}
      <Card className="p-6 lg:col-span-2 min-h-[400px] flex flex-col justify-center items-center relative">
        <div className="absolute top-4 right-4 text-xs text-slate-400 font-mono bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded">
           Данные по: {activeMetric?.name}
        </div>

        <div className="w-full h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'bar' ? (
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-700" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 12, fill: '#64748b' }} 
                  axisLine={false} 
                  tickLine={false}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis 
                  tick={{ fontSize: 12, fill: '#64748b' }} 
                  axisLine={false} 
                  tickLine={false} 
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#6366f1' : '#818cf8'} />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                <PolarGrid stroke="#e2e8f0" className="dark:stroke-slate-700" />
                <PolarAngleAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                <Radar
                  name={activeMetric?.name}
                  dataKey="value"
                  stroke="#8b5cf6"
                  fill="#8b5cf6"
                  fillOpacity={0.3}
                />
                <Tooltip content={<CustomTooltip />} />
              </RadarChart>
            )}
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
interface CustomTooltipProps {
  active?: boolean;
  payload?: any[]; // Используем any[] для payload, так как Recharts вкладывает туда сложные объекты
  label?: string;
}

// Кастомный тултип для стилизации
function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-lg shadow-xl text-sm">
        <p className="font-bold text-slate-900 dark:text-white mb-1">{label}</p>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-500" />
          <span className="text-slate-500 dark:text-slate-400">Значение:</span>
          <span className="font-mono font-medium text-indigo-600 dark:text-indigo-400">
            {data?.formatted || data?.value}
          </span>
        </div>
      </div>
    );
  }
  return null;
}