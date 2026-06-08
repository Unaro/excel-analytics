'use client';

import { useMemo } from 'react';
import { groupThresholdsByValue } from '@/shared/lib/utils/thresholds';
import type { VirtualMetric } from '@/shared/lib/validators';

export interface ThresholdGroupingResult {
  groupedThresholds: ReturnType<typeof groupThresholdsByValue>;
}

export function useThresholdGrouping(
  virtualMetrics: VirtualMetric[],
  activeMetricIds: string[]
): ThresholdGroupingResult {
  const groupedThresholds = useMemo(
    () => groupThresholdsByValue(virtualMetrics, activeMetricIds),
    [virtualMetrics, activeMetricIds]
  );

  return { groupedThresholds };
}