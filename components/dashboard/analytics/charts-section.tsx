'use client';

import { useState, useMemo, memo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { DashboardComputationResult } from '@/types';
import { Card } from '@/components/ui/card';
import { BarChart3, Hexagon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCompactNumber, formatNumber } from '@/lib/utils/format';

interface ChartsSectionProps {
  result: DashboardComputationResult;
}

type ChartType = 'bar' | 'radar';

interface ChartDataItem {
  name: string;
  value: number;
  formatted: string;
}

// Тултип (вынесен для чистоты)
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: { formatted: string } }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length > 0) {
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-lg shadow-xl text-sm z-50 animate-in fade-in zoom-in-95 duration-200">
        <p className="font-bold text-slate-900 dark:text-white mb-1">{label}</p>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-500" />
          <span className="text-slate-500 dark:text-slate-400 text-xs uppercase font-bold">Значение</span>
          <span className="font-mono font-medium text-indigo-600 dark:text-indigo-300 ml-auto">
            {data.formatted}
          </span>
        </div>
      </div>
    );
  }
  return null;
}

// --- 1. Мемоизированный Бар-чарт ---
const MemoizedBarChart = memo(function BarChartComp({ data, axisColor }: { data: ChartDataItem[], axisColor: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={axisColor} strokeOpacity={0.2} />
        <XAxis 
          dataKey="name" 
          tick={{ fontSize: 11, fill: axisColor }} 
          axisLine={false} 
          tickLine={false}
          angle={-15}
          textAnchor="end"
          interval={0}
        />
        <YAxis 
          tick={{ fontSize: 11, fill: axisColor }} 
          axisLine={false} 
          tickLine={false}
          tickFormatter={(val) => formatCompactNumber(val)}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--tooltip-cursor)', opacity: 0.1 }} />
        
        {/* 
           ВКЛЮЧАЕМ АНИМАЦИЮ ОБРАТНО 
           Ключевой момент: animationDuration={300}
        */}
        <Bar 
          dataKey="value" 
          radius={[4, 4, 0, 0]} 
          isAnimationActive={true}
          animationDuration={300} 
          animationEasing="ease-in-out"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#6366f1' : '#818cf8'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});

// --- 2. Мемоизированный Радар ---
const MemoizedRadarChart = memo(function RadarChartComp({ data, axisColor, label }: { data: ChartDataItem[], axisColor: string, label?: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
        <PolarGrid stroke={axisColor} strokeOpacity={0.2} />
        <PolarAngleAxis dataKey="name" tick={{ fontSize: 11, fill: axisColor }} />
        <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
        
        <Radar
          name={label}
          dataKey="value"
          stroke="#8b5cf6"
          fill="#8b5cf6"
          fillOpacity={0.4}
          isAnimationActive={true}
          animationDuration={300}
          animationEasing="ease-out"
        />
        <Tooltip content={<CustomTooltip />} />
      </RadarChart>
    </ResponsiveContainer>
  );
});

export function ChartsSection({ result }: ChartsSectionProps) {
  const [activeMetricId, setActiveMetricId] = useState<string>(
    result.virtualMetrics[0]?.id || ''
  );
  const [chartType, setChartType] = useState<ChartType>('bar');

  // Данные пересчитываются мгновенно благодаря useMemo
  const chartData = useMemo<ChartDataItem[]>(() => {
    if (!result || !activeMetricId) return [];

    return result.groups.map(group => {
      const metricValue = group.virtualMetrics.find(vm => vm.virtualMetricId === activeMetricId);
      return {
        name: group.groupName,
        value: metricValue?.value ?? 0,
        formatted: metricValue?.formattedValue !== undefined ? metricValue.formattedValue : '—',
      };
    });
  }, [result, activeMetricId]);

  const activeMetric = result.virtualMetrics.find(m => m.id === activeMetricId);

  if (!result || result.groups.length === 0) return null;

  const axisColor = "#94a3b8"; 

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[500px]"> 
      {/* ЛЕВАЯ ЧАСТЬ: Меню */}
      <Card className="p-5 lg:col-span-1 flex flex-col gap-4 h-full">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white mb-1">Визуализация</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Выберите показатель для анализа.
          </p>
        </div>

        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-full shrink-0">
          <button
            onClick={() => setChartType('bar')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-all",
              chartType === 'bar' ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm" : "text-slate-500 dark:text-slate-400"
            )}
          >
            <BarChart3 size={16} /> Столбцы
          </button>
          <button
            onClick={() => setChartType('radar')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-all",
              chartType === 'radar' ? "bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-300 shadow-sm" : "text-slate-500 dark:text-slate-400"
            )}
          >
            <Hexagon size={16} /> Радар
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-1">
          {result.virtualMetrics.map(vm => (
            <button
              key={vm.id}
              onClick={() => setActiveMetricId(vm.id)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors border",
                activeMetricId === vm.id 
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300" 
                  : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-300"
              )}
            >
              {vm.name}
            </button>
          ))}
        </div>
      </Card>

      {/* ПРАВАЯ ЧАСТЬ: График */}
      <Card className="p-6 lg:col-span-2 h-full flex flex-col justify-center items-center relative bg-white dark:bg-slate-900 overflow-hidden">
        <div className="absolute top-4 right-4 text-xs text-slate-400 font-mono bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded border border-slate-100 dark:border-slate-700 z-10">
           {activeMetric?.name}
        </div>

        <div className="w-full h-full pt-4">
          {chartType === 'bar' ? (
            <MemoizedBarChart data={chartData} axisColor={axisColor} />
          ) : (
            <MemoizedRadarChart data={chartData} axisColor={axisColor} label={activeMetric?.name} />
          )}
        </div>
      </Card>
    </div>
  );
}