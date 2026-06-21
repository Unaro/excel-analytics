'use client';
import { memo, useMemo } from 'react';
import { BreakdownItem, VirtualMetricValue } from '@/entities/metric';
import { GroupBarChart } from './Chart/GroupBarChart';
import { GroupRadarChart } from './Chart/GroupRadarChart';
import { VirtualMetric } from '@/shared/lib/validators';
import { groupThresholdsByValue } from '@/shared/lib/utils/thresholds';
import { toDisplayScale } from '@/shared/lib/utils/metric-colors';
import { ThresholdLegend } from '@/shared/ui/threshold-marker/ThresholdLegend';
import { DataItem } from '@/shared/lib/types/chart-data';
import { ChartType } from '@/shared/lib/types/chart';

interface GroupChartsPanelProps {
  breakdown: BreakdownItem[];
  virtualMetrics: VirtualMetricValue[];
  metricConfigs: VirtualMetric[];
  activeMetricIds: string[];
  chartTypes: ChartType[];
  /** Код → отображаемое имя (словарь). Только для подписей/тултипов:
   *  позиция категории — по сырому label, иначе дубль имён ломает оси. */
  resolveLabel?: (label: string) => string;
}

/**
 * Контейнер для всех активных визуализаций.
 * Показывает несколько графиков одновременно.
 */
export const GroupChartsPanel = memo(function GroupChartsPanel({
  breakdown,
  virtualMetrics,
  metricConfigs,
  activeMetricIds,
  chartTypes,
  resolveLabel,
}: GroupChartsPanelProps) {
  const activeMetrics = useMemo(
    () => virtualMetrics.filter(vm => activeMetricIds.includes(vm.virtualMetricId)),
    [virtualMetrics, activeMetricIds]
  );
  const metricKeys = activeMetrics.map(vm => vm.virtualMetricId);

  // id метрики → её формат отображения: чарты строятся в масштабе отображения
  // (percent-доля → проценты), чтобы метрики с разными форматами сводились
  // (0.7 как percent и 70 как percent_raw обе дают 70).
  const formatById = useMemo(() => {
    const map = new Map<string, string | undefined>();
    metricConfigs.forEach(vm => map.set(vm.id, vm.displayFormat));
    return map;
  }, [metricConfigs]);

  const groupedThresholds = useMemo(
    () => groupThresholdsByValue(metricConfigs, metricKeys),
    [metricConfigs, metricKeys]
  );

  const multiMetricData = useMemo<DataItem[]>(() => {
    return breakdown.map(item => {
      const row: DataItem = { name: item.label };
      activeMetrics.forEach(vm => {
        const val = item.virtualMetrics.find(m => m.virtualMetricId === vm.virtualMetricId);
        row[vm.virtualMetricId] = toDisplayScale(val?.value ?? 0, formatById.get(vm.virtualMetricId));
      });
      groupedThresholds.forEach((group, gi) => {
        row[`__threshold_${gi}`] = group.y;
      });
      return row;
    });
  }, [breakdown, activeMetrics, groupedThresholds, formatById]);

  
  const metricNames = useMemo(() => {
    const map: Record<string, string> = {};
    activeMetrics.forEach(vm => {
      map[vm.virtualMetricId] = vm.virtualMetricName;
    });
    return map;
  }, [activeMetrics]);



  if (activeMetrics.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Легенда пороговых значений */}
      <ThresholdLegend
        virtualMetrics={metricConfigs}
        activeMetricIds={activeMetricIds}
      />

      {/* Один выбранный чарт — на всю ширину (не шире контента/экрана);
          два — рядом по половине на широких экранах. */}
      <div className={chartTypes.length > 1 ? 'grid grid-cols-1 xl:grid-cols-2 gap-6' : 'grid grid-cols-1 gap-6'}>
        {chartTypes.includes('bar') && (
          <GroupBarChart
            data={multiMetricData}
            metricKeys={metricKeys}
            metricNames={metricNames}
            title="Сравнение по столбцам"
            metricConfigs={metricConfigs}
            resolveLabel={resolveLabel}
          />
        )}
        {chartTypes.includes('radar') && (
          <GroupRadarChart
            data={multiMetricData}
            metricKeys={metricKeys}
            metricNames={metricNames}
            title="Радарная диаграмма"
            metricConfigs={metricConfigs}
            resolveLabel={resolveLabel}
          />
        )}
      </div>
    </div>
  );
});