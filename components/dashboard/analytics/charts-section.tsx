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

// --- Тултип ---
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: {
      name: string;
      formatted: string;
    };
  }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length > 0) {
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-lg shadow-xl text-sm z-50 animate-in fade-in zoom-in-95">
        <p className="font-bold text-slate-900 dark:text-white mb-1 max-w-[200px] truncate">{label}</p>
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
      <BarChart data={data} margin={{ top: 20, right: 10, left: 0, bottom: 50 }}> {/* Уменьшили margin.right, увеличили bottom */}
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={axisColor} strokeOpacity={0.2} />
        <XAxis 
          dataKey="name" 
          tick={{ fontSize: 10, fill: axisColor }} // Шрифт чуть меньше для мобилок
          axisLine={false} 
          tickLine={false}
          angle={-25} // Чуть больший угол наклона, чтобы влезало больше текста
          textAnchor="end"
          interval={0} // Показываем все подписи (Recharts сам скроет, если совсем не влезут, но мы стараемся)
          height={60} // Даем место под наклонный текст
        />
        <YAxis 
          tick={{ fontSize: 10, fill: axisColor }} 
          axisLine={false} 
          tickLine={false}
          tickFormatter={(val) => formatCompactNumber(val)}
          width={40} // Фиксированная ширина оси Y, чтобы график не прыгал
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--tooltip-cursor)', opacity: 0.1 }} />
        <Bar 
          dataKey="value" 
          radius={[4, 4, 0, 0]} 
          isAnimationActive={true}
          animationDuration={800} 
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
      {/* outerRadius="70%" чтобы на маленьких экранах подписи не обрезались краями контейнера */}
      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
        <PolarGrid stroke={axisColor} strokeOpacity={0.2} />
        <PolarAngleAxis 
          dataKey="name" 
          tick={{ fontSize: 10, fill: axisColor }} 
        />
        <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
        <Radar
          name={label}
          dataKey="value"
          stroke="#8b5cf6"
          fill="#8b5cf6"
          fillOpacity={0.4}
          isAnimationActive={true}
          animationDuration={800}
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:h-[500px]"> 
      {/* 
         ВАЖНОЕ ИЗМЕНЕНИЕ LAYOUT: 
         1. lg:h-[500px] - фиксированная высота только на десктопе.
         2. На мобильном высота определяется контентом (auto).
      */}
      
      {/* ЛЕВАЯ ЧАСТЬ: Меню */}
      <Card className="p-5 lg:col-span-1 flex flex-col gap-4 lg:h-full order-2 lg:order-1">
        {/* order-2 на мобильном опускает настройки ПОД график (опционально, но часто график важнее)
            Если хочешь настройки сверху, убери order-2 lg:order-1 */}
        
        <div className="flex justify-between items-center lg:block">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white mb-1">Визуализация</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 hidden lg:block">
              Выберите показатель для анализа.
            </p>
          </div>
          
          {/* Переключатель типа графика (компактный на мобиле) */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg shrink-0 lg:w-full lg:mt-4">
            <button
              onClick={() => setChartType('bar')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                chartType === 'bar' ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm" : "text-slate-500 dark:text-slate-400"
              )}
              title="Столбчатая диаграмма"
            >
              <BarChart3 size={16} /> <span className="hidden sm:inline">Столбцы</span>
            </button>
            <button
              onClick={() => setChartType('radar')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                chartType === 'radar' ? "bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-300 shadow-sm" : "text-slate-500 dark:text-slate-400"
              )}
              title="Радарная диаграмма"
            >
              <Hexagon size={16} /> <span className="hidden sm:inline">Радар</span>
            </button>
          </div>
        </div>

        {/* Список метрик с ограничением высоты на мобильном */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-1 max-h-[150px] lg:max-h-none">
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
      <Card className="p-4 lg:p-6 lg:col-span-2 h-[350px] lg:h-full flex flex-col justify-center items-center relative bg-white dark:bg-slate-900 overflow-hidden order-1 lg:order-2">
        <div className="absolute top-4 right-4 text-[10px] lg:text-xs text-slate-400 font-mono bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded border border-slate-100 dark:border-slate-700 z-10 max-w-[150px] truncate">
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