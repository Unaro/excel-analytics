// entities/groupMetricConfig/ui/GroupMetricCell.tsx
'use client';

import { useMemo } from 'react';
import { MetricCell } from '@/entities/metric';
import type { DisplayFormat } from '@/entities/metric';
import { useGroupMetricConfigStore } from '@/entities/group-metric-config';

interface GroupMetricCellProps {
  groupId: string;
  metricId: string;
  value: number | null;
  formattedValue: string;
  displayFormat: DisplayFormat;
  decimalPlaces: number;
  unit?: string;
}

/**
 * "Умная" ячейка метрики для групп показателей.
 */
export function GroupMetricCell({
  groupId,
  metricId,
  value,
  formattedValue,
  displayFormat,
  decimalPlaces,
  unit,
}: GroupMetricCellProps) {
  const colorConfig = useGroupMetricConfigStore(
    (s) => s.configsByGroup[groupId]?.[metricId]?.colorConfig
  );

  const metric = useMemo(
    () => ({
      id: metricId,
      name: '',
      displayFormat,
      decimalPlaces,
      order: 0,
      unit,
      colorConfig,
    }),
    [metricId, displayFormat, decimalPlaces, unit, colorConfig]
  );

  return <MetricCell value={value} formattedValue={formattedValue} metric={metric} />;
}