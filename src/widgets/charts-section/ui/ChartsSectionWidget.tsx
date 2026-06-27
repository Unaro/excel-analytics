'use client';

import { useTheme } from 'next-themes';
import { Card } from '@/shared/ui/card';
import { BarChart3, Hexagon } from 'lucide-react';
import { ThresholdLegend } from '@/shared/ui/threshold-marker';
import { useChartDataMapper } from '../model/use-chart-data-mapper';
import { BarChartView } from './BarChartView';
import { RadarChartView } from './RadarChartView';
import { MetricSelector } from './MetricSelector';
import { cn } from '@/shared/lib/utils';
import type { BreakdownItem, VirtualMetricValue } from '@/entities/metric';
import type { VirtualMetric } from '@/shared/lib/validators';
import { ChartMode, ChartType } from '@/shared/lib/types/chart';

interface ChartsSectionWidgetProps {
  breakdown: BreakdownItem[];
  virtualMetrics: VirtualMetricValue[];
  metricConfigs: VirtualMetric[];
  activeMetricIds: string[];
  chartTypes: ChartType[];
  onActiveMetricIdsChange?: (ids: string[]) => void;
  onChartTypesChange?: (types: ChartType[]) => void;
  mode?: ChartMode;
  /** Палитра цветов метрик-серий (из dashboard.paletteId). */
  palette?: string[];
}

// Partial: дашборд предлагает не все типы ChartType (treemap пока только на
// странице группы). Object.keys ниже строит кнопки лишь по заданным ключам.
const CHART_TYPE_CONFIG: Partial<Record<ChartType, { label: string; icon: typeof BarChart3; colorClass: string }>> = {
  bar: { label: 'Столбцы', icon: BarChart3, colorClass: 'text-indigo-600 dark:text-indigo-300' },
  radar: { label: 'Радар', icon: Hexagon, colorClass: 'text-purple-600 dark:text-purple-300' },
};

export function ChartsSectionWidget({
  breakdown,
  virtualMetrics,
  metricConfigs,
  activeMetricIds,
  chartTypes,
  onActiveMetricIdsChange,
  onChartTypesChange,
  mode = 'multi',
  palette,
}: ChartsSectionWidgetProps) {
  const { resolvedTheme } = useTheme();
  const axisColor = resolvedTheme === 'dark' ? '#94a3b8' : '#64748b';

  const { chartData, metricNames } = useChartDataMapper(
    breakdown, activeMetricIds, virtualMetrics, metricConfigs
  );

  if (breakdown.length === 0 || metricConfigs.length === 0) return null;

  const chartProps = { data: chartData, activeMetricIds, metricNames, axisColor, virtualMetrics: metricConfigs, palette };

  const toggleMetric = (id: string) => {
    if (!onActiveMetricIdsChange) return;
    const isSelected = activeMetricIds.includes(id);
    if (isSelected) {
      if (activeMetricIds.length === 1) return;
      onActiveMetricIdsChange(activeMetricIds.filter(x => x !== id));
    } else {
      if (activeMetricIds.length >= 5) return;
      onActiveMetricIdsChange([...activeMetricIds, id]);
    }
  };

  const toggleChartType = (type: ChartType) => {
    if (!onChartTypesChange) return;
    if (mode === 'single') {
      onChartTypesChange([type]);
    } else {
      const isSelected = chartTypes.includes(type);
      if (isSelected) {
        if (chartTypes.length === 1) return;
        onChartTypesChange(chartTypes.filter(t => t !== type));
      } else {
        onChartTypesChange([...chartTypes, type]);
      }
    }
  };

  const singleActiveType = mode === 'single' ? (chartTypes[0] ?? 'bar') : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:h-[500px]">
      <Card className="p-5 lg:col-span-1 flex flex-col gap-4 lg:h-full order-2 lg:order-1">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white mb-1">Визуализация</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 hidden lg:block">
            {mode === 'single' ? 'Выберите тип графика и показатели (макс 5)' : 'Выберите тип графика'}
          </p>
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg lg:w-full"
          role={mode === 'single' ? 'radiogroup' : 'group'} aria-label="Тип графика">
          {(Object.keys(CHART_TYPE_CONFIG) as ChartType[]).map(type => {
            const config = CHART_TYPE_CONFIG[type];
            if (!config) return null;
            const Icon = config.icon;
            const isSelected = chartTypes.includes(type);
            return (
              <button key={type} onClick={() => toggleChartType(type)}
                role={mode === 'single' ? 'radio' : 'checkbox'} aria-checked={isSelected}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                  isSelected ? `bg-white dark:bg-slate-700 ${config.colorClass} shadow-sm` : 'text-slate-500 dark:text-slate-400'
                )}>
                <Icon size={16} />
                <span className="hidden sm:inline">{config.label}</span>
              </button>
            );
          })}
        </div>
        {mode === 'single' && (
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-1 max-h-[150px] lg:max-h-none">
            {metricConfigs.map(vm => (
              <MetricSelector key={vm.id} metric={vm}
                isSelected={activeMetricIds.includes(vm.id)}
                colorIndex={activeMetricIds.indexOf(vm.id)}
                onToggle={() => toggleMetric(vm.id)} />
            ))}
          </div>
        )}
      </Card>
      <Card className="p-4 lg:p-6 lg:col-span-2 h-[350px] lg:h-full flex flex-col bg-white dark:bg-slate-900 overflow-hidden order-1 lg:order-2">
        <ThresholdLegend virtualMetrics={metricConfigs} activeMetricIds={activeMetricIds} />
        <div className="w-full h-full pt-2 flex-1">
          {mode === 'single' ? (
            singleActiveType === 'bar' ? <BarChartView {...chartProps} /> : <RadarChartView {...chartProps} />
          ) : (
            <div className={cn('w-full h-full grid gap-4',
              chartTypes.length === 1 ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-2')}>
              {chartTypes.includes('bar') && <BarChartView {...chartProps} />}
              {chartTypes.includes('radar') && <RadarChartView {...chartProps} />}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}