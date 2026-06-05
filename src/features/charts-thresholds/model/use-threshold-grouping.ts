'use client';
import { useMemo } from 'react';
import { groupThresholdsByValue } from '@/shared/lib/utils/thresholds';
import type { VirtualMetric } from '@/shared/lib/validators';

export function useThresholdGrouping(virtualMetrics: VirtualMetric[], activeMetricIds: string[]) {
  const groupedThresholds = useMemo(
    () => groupThresholdsByValue(virtualMetrics, activeMetricIds),
    [virtualMetrics, activeMetricIds]
  );
  return { groupedThresholds };
}