'use client';
import { useMemo } from 'react';
import { groupThresholdsByValue } from '@/shared/lib/utils/thresholds';
import type { BreakdownItem, VirtualMetricValue } from '@/entities/metric';
import type { VirtualMetric } from '@/shared/lib/validators';
import { DataItem } from '@/shared/lib/types/chart-data';

export function useChartDataMapper(
  breakdown: BreakdownItem[],
  activeMetricIds: string[],
  virtualMetrics: VirtualMetricValue[],
  metricConfigs: VirtualMetric[]
) {
  const groupedThresholds = useMemo(
    () => groupThresholdsByValue(metricConfigs, activeMetricIds),
    [metricConfigs, activeMetricIds]
  );

  const chartData = useMemo<DataItem[]>(() => {
    return breakdown.map(item => {
      const row: DataItem = { name: item.label };

      // Реальные значения метрик
      activeMetricIds.forEach(vmId => {
        const vm = item.virtualMetrics?.find(v => v.virtualMetricId === vmId);
        row[vmId] = vm?.value ?? 0;
        row[`${vmId}_formatted`] = vm?.formattedValue ?? '—';
      });

      // Пороговые значения для радар-полигонов
      groupedThresholds.forEach((group, gi) => {
        row[`__threshold_${gi}`] = group.y;
      });

      return row;
    });
  }, [breakdown, activeMetricIds, groupedThresholds]);

  const metricNames = useMemo<Record<string, string>>(() => {
    const names: Record<string, string> = {};
    virtualMetrics.forEach(vm => {
      if (activeMetricIds.includes(vm.virtualMetricId)) {
        names[vm.virtualMetricId] = vm.virtualMetricName || vm.virtualMetricId;
      }
    });
    return names;
  }, [virtualMetrics, activeMetricIds]);

  return { chartData, metricNames, groupedThresholds };
}