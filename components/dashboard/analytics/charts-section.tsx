'use client';

import { useState, useMemo, memo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend
} from 'recharts';
import { DashboardComputationResult } from '@/types';
import { Card } from '@/components/ui/card';
import { BarChart3, Hexagon, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCompactNumber } from '@/lib/utils/format';

interface ChartsSectionProps {
  result: DashboardComputationResult;
}

type ChartType = 'bar' | 'radar';

// Палитра
const CHART_COLORS = [
  '#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#3b82f6',
];

// --- 1. Строгая типизация данных графика ---

/**
 * Интерфейс для одной точки данных (один столбец на оси X).
 * name: Название группы (строка)
 * [key: string]: Значения метрик (number) или отформатированные строки.
 */
interface ChartDataItem {
  name: string;
  [key: string]: string | number; 
}

// --- 2. Типизация Tooltip (Recharts Payload) ---

/**
 * Типизация payload, который Recharts прокидывает в CustomTooltip.
 */
interface RechartsTooltipPayload {
  name: string;          // Это metricId (dataKey) или name, указанный в компоненте Bar/Radar
  value?: number;
  color?: string;
  payload: ChartDataItem; // Ссылка на исходный объект данных
  dataKey: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: RechartsTooltipPayload[]; 
  label?: string;
  metricNames: Record<string, string>;
}

function CustomTooltip({ active, payload, label, metricNames }: CustomTooltipProps) {
  if (active && payload && payload.length > 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-lg shadow-xl text-sm z-50 animate-in fade-in zoom-in-95">
        <p className="font-bold text-slate-900 dark:text-white mb-2 max-w-[200px] truncate border-b border-slate-100 dark:border-slate-800 pb-1">
          {label}
        </p>
        <div className="space-y-1.5">
          {payload.map((entry) => {
            // entry.name здесь может быть metricId. Получаем человеческое название.
            const metricId = entry.dataKey; // Используем dataKey как надежный ID
            const metricName = metricNames[metricId] || entry.name;
            
            // Безопасно достаем форматированное значение
            const formattedValue = entry.payload[`${metricId}_formatted`];
            
            return (
              <div key={metricId} className="flex items-center gap-2">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: entry.color }} 
                />
                <span className="text-slate-500 dark:text-slate-400 text-xs">{metricName}:</span>
                <span className="font-mono font-medium text-slate-900 dark:text-slate-200 ml-auto">
                  {/* Проверка типов: если formattedValue строка - выводим, иначе fallback на value */}
                  {typeof formattedValue === 'string' ? formattedValue : entry.value}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
}

// --- 3. Компоненты графиков (Typed Props) ---

interface ChartComponentProps {
  data: ChartDataItem[];
  activeMetricIds: string[];
  metricNames: Record<string, string>;
  axisColor: string;
}

const MemoizedBarChart = memo(function BarChartComp({ 
  data, 
  activeMetricIds, 
  metricNames,
  axisColor 
}: ChartComponentProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 20, right: 10, left: 0, bottom: 50 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={axisColor} strokeOpacity={0.2} />
        <XAxis 
          dataKey="name" 
          tick={{ fontSize: 10, fill: axisColor }} 
          axisLine={false} 
          tickLine={false}
          angle={-25} 
          textAnchor="end"
          interval={0} 
          height={60} 
        />
        <YAxis 
          tick={{ fontSize: 10, fill: axisColor }} 
          axisLine={false} 
          tickLine={false}
          tickFormatter={(val: number) => formatCompactNumber(val)}
          width={40} 
        />
        <Tooltip 
          content={<CustomTooltip metricNames={metricNames} />} 
          cursor={{ fill: 'var(--tooltip-cursor)', opacity: 0.1 }} 
        />
        {activeMetricIds.map((metricId, index) => (
          <Bar 
            key={metricId}
            dataKey={metricId}
            name={metricNames[metricId]} 
            fill={CHART_COLORS[index % CHART_COLORS.length]}
            radius={[4, 4, 0, 0]} 
            isAnimationActive={true}
            animationDuration={800}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
});

const MemoizedRadarChart = memo(function RadarChartComp({ 
  data, 
  activeMetricIds, 
  metricNames,
  axisColor 
}: ChartComponentProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
        <PolarGrid stroke={axisColor} strokeOpacity={0.2} />
        <PolarAngleAxis 
          dataKey="name" 
          tick={{ fontSize: 10, fill: axisColor }} 
        />
        <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
        
        {activeMetricIds.map((metricId, index) => {
          const color = CHART_COLORS[index % CHART_COLORS.length];
          return (
            <Radar
              key={metricId}
              name={metricNames[metricId]}
              dataKey={metricId}
              stroke={color}
              fill={color}
              fillOpacity={0.3} 
              isAnimationActive={true}
            />
          );
        })}
        <Tooltip content={<CustomTooltip metricNames={metricNames} />} />
        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
      </RadarChart>
    </ResponsiveContainer>
  );
});

export function ChartsSection({ result }: ChartsSectionProps) {
  const [activeMetricIds, setActiveMetricIds] = useState<string[]>(
    result.virtualMetrics.length > 0 ? [result.virtualMetrics[0].id] : []
  );
  
  const [chartType, setChartType] = useState<ChartType>('bar');

  const toggleMetric = (id: string) => {
    setActiveMetricIds(prev => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter(item => item !== id);
      } else {
        if (prev.length >= 5) return prev; 
        return [...prev, id];
      }
    });
  };

  const metricNames = useMemo(() => {
    const map: Record<string, string> = {};
    result.virtualMetrics.forEach(vm => {
      map[vm.id] = vm.name;
    });
    return map;
  }, [result.virtualMetrics]);

  // Строгая типизация useMemo
  const chartData = useMemo<ChartDataItem[]>(() => {
    if (!result || activeMetricIds.length === 0) return [];

    return result.groups.map(group => {
      // Инициализируем объект с обязательным полем name
      const dataItem: ChartDataItem = {
        name: group.groupName,
      };

      activeMetricIds.forEach(metricId => {
        const val = group.virtualMetrics.find(vm => vm.virtualMetricId === metricId);
        
        // Записываем числовое значение для оси
        dataItem[metricId] = val?.value ?? 0;
        
        // Записываем отформатированное значение
        dataItem[`${metricId}_formatted`] = val?.formattedValue ?? '—';
      });

      return dataItem;
    });
  }, [result, activeMetricIds]);

  if (!result || result.groups.length === 0) return null;

  const axisColor = "#94a3b8"; 

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:h-[500px]"> 
      <Card className="p-5 lg:col-span-1 flex flex-col gap-4 lg:h-full order-2 lg:order-1">
        <div className="flex justify-between items-center lg:block">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white mb-1">Визуализация</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 hidden lg:block">
              Выберите показатели (макс 5).
            </p>
          </div>
          
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg shrink-0 lg:w-full lg:mt-4">
            <button
              onClick={() => setChartType('bar')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                chartType === 'bar' ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm" : "text-slate-500 dark:text-slate-400"
              )}
            >
              <BarChart3 size={16} /> <span className="hidden sm:inline">Столбцы</span>
            </button>
            <button
              onClick={() => setChartType('radar')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                chartType === 'radar' ? "bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-300 shadow-sm" : "text-slate-500 dark:text-slate-400"
              )}
            >
              <Hexagon size={16} /> <span className="hidden sm:inline">Радар</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-1 max-h-[150px] lg:max-h-none">
          {result.virtualMetrics.map((vm) => {
             const isSelected = activeMetricIds.includes(vm.id);
             const colorIndex = activeMetricIds.indexOf(vm.id);
             const color = colorIndex >= 0 ? CHART_COLORS[colorIndex % CHART_COLORS.length] : undefined;
             
             return (
              <button
                key={vm.id}
                onClick={() => toggleMetric(vm.id)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors border select-none",
                  isSelected
                    ? "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100" 
                    : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-500 dark:text-slate-500"
                )}
              >
                <div className="flex items-center gap-2">
                  <div 
                    className={cn("w-2.5 h-2.5 rounded-full transition-all", isSelected ? "scale-100" : "scale-0 opacity-0")}
                    style={{ backgroundColor: color }}
                  />
                  <span>{vm.name}</span>
                </div>
                {isSelected && <Check size={14} className="text-slate-400" />}
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="p-4 lg:p-6 lg:col-span-2 h-[350px] lg:h-full flex flex-col justify-center items-center relative bg-white dark:bg-slate-900 overflow-hidden order-1 lg:order-2">
        <div className="w-full h-full pt-2">
          {chartType === 'bar' ? (
            <MemoizedBarChart 
              data={chartData} 
              activeMetricIds={activeMetricIds} 
              metricNames={metricNames}
              axisColor={axisColor} 
            />
          ) : (
            <MemoizedRadarChart 
              data={chartData} 
              activeMetricIds={activeMetricIds} 
              metricNames={metricNames}
              axisColor={axisColor} 
            />
          )}
        </div>
      </Card>
    </div>
  );
}