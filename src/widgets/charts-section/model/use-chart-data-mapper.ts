'use client';
import { useMemo } from 'react';
import { groupThresholdsByValue } from '@/shared/lib/utils/thresholds';
import { toDisplayScale } from '@/shared/lib/utils/metric-colors';
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

  // id метрики → формат: чарты в масштабе отображения, чтобы метрики с разными
  // форматами сводились (percent 0.7 и percent_raw 70 → обе 70).
  const formatById = useMemo(() => {
    const map = new Map<string, string | undefined>();
    metricConfigs.forEach(vm => map.set(vm.id, vm.displayFormat));
    return map;
  }, [metricConfigs]);

  const chartData = useMemo<DataItem[]>(() => {
    return breakdown.map(item => {
      const row: DataItem = { name: item.label };

      const vmMap = new Map(item.virtualMetrics?.map(vm => [vm.virtualMetricId, vm]));

      for (const vmId of activeMetricIds) {
        const vm = vmMap.get(vmId);
        row[vmId] = toDisplayScale(vm?.value ?? 0, formatById.get(vmId));
      }

      groupedThresholds.forEach((group, gi) => {
        row[`__threshold_${gi}`] = group.y;
      });

      return row;
    });
  }, [breakdown, activeMetricIds, groupedThresholds, formatById]);

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