// entities/groupMetricConfig/ui/GroupMetricCell.tsx
'use client';

import { useMemo } from 'react';
import { MetricCell } from '@/entities/metric';
import type { DisplayFormat } from '@/entities/metric';
import { useGroupMetricConfigStore } from '@/entities/group-metric-config';
import { useMetricTemplateStore } from '@/entities/metric';

interface GroupMetricCellProps {
  groupId: string;
  metricId: string;
  value: number | null;
  formattedValue: string;
  displayFormat: DisplayFormat;
  decimalPlaces: number;
  unit?: string;
  /** Шаблон метрики — единый источник условного форматирования. */
  templateId?: string;
  /** Значение введено из узла файла-агрегата — подсвечиваем ячейку. */
  fromNode?: boolean;
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
  templateId,
  fromNode,
}: GroupMetricCellProps) {
  // Единый источник CF — шаблон; групповой стор остаётся фолбэком для
  // немигрированных метрик (правила «переедут» при редактировании).
  const groupColorConfig = useGroupMetricConfigStore(
    (s) => s.configsByGroup[groupId]?.[metricId]?.colorConfig
  );
  const templateColorConfig = useMetricTemplateStore(
    (s) => (templateId ? s.templates.find((t) => t.id === templateId)?.colorConfig : undefined)
  );
  const colorConfig = templateColorConfig ?? groupColorConfig;

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

  return <MetricCell value={value} formattedValue={formattedValue} metric={metric} fromNode={fromNode} />;
}