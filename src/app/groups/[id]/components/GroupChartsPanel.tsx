'use client';
import { memo, useMemo } from 'react';
import { ChartType } from './ChartTypeSelector';
import { BreakdownItem, VirtualMetricValue } from '@/entities/metric';
import { GroupBarChart } from './Chart/GroupBarChart';
import { GroupRadarChart } from './Chart/GroupRadarChart';

interface GroupChartsPanelProps {
  breakdown: BreakdownItem[];
  virtualMetrics: VirtualMetricValue[];
  activeMetricIds: string[];
  chartTypes: ChartType[];
}

interface ChartDataItem {
  name: string;
  [key: string]: string | number;
}

/**
 * Контейнер для всех активных визуализаций.
 * Показывает несколько графиков одновременно.
 */
export const GroupChartsPanel = memo(function GroupChartsPanel({
  breakdown,
  virtualMetrics,
  activeMetricIds,
  chartTypes,
}: GroupChartsPanelProps) {
  const activeMetrics = useMemo(
    () => virtualMetrics.filter(vm => activeMetricIds.includes(vm.virtualMetricId)),
    [virtualMetrics, activeMetricIds]
  );

  const multiMetricData = useMemo<ChartDataItem[]>(() => {
    return breakdown.map(item => {
      const row: ChartDataItem = { name: item.label };
      activeMetrics.forEach(vm => {
        const val = item.virtualMetrics.find(m => m.virtualMetricId === vm.virtualMetricId);
        row[vm.virtualMetricId] = val?.value ?? 0;
      });
      return row;
    });
  }, [breakdown, activeMetrics]);

  
  const metricNames = useMemo(() => {
    const map: Record<string, string> = {};
    activeMetrics.forEach(vm => {
      map[vm.virtualMetricId] = vm.virtualMetricName;
    });
    return map;
  }, [activeMetrics]);

  const metricKeys = activeMetrics.map(vm => vm.virtualMetricId);

  if (activeMetrics.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {chartTypes.includes('bar') && (
        <GroupBarChart
          data={multiMetricData}
          metricKeys={metricKeys}
          metricNames={metricNames}
          title="Сравнение по столбцам"
        />
      )}
      {chartTypes.includes('radar') && (
        <GroupRadarChart
          data={multiMetricData}
          metricKeys={metricKeys}
          metricNames={metricNames}
          title="Радарная диаграмма"
        />
      )}
    </div>
  );
});