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
      
      const vmMap = new Map(item.virtualMetrics?.map(vm => [vm.virtualMetricId, vm]));
      
      for (const vmId of activeMetricIds) {
        const vm = vmMap.get(vmId);
        row[vmId] = vm?.value ?? 0;
      }
      
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