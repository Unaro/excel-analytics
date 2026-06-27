'use client';
import { useCallback, memo } from 'react';
import { GroupKpiCard } from './GroupKpiCard';
import { VirtualMetricValue } from '@/entities/metric';
import type { MetricChartStyle } from '@/shared/lib/types/chart';

interface GroupKpiGridProps {
  metrics: VirtualMetricValue[];
  activeMetricIds: string[];
  recordCount: number;
  onToggleMetric: (id: string) => void;
  /** Стиль чарта по sourceMetricId (столбец/линия). */
  chartStyleByMetricId?: Record<string, MetricChartStyle | undefined>;
  /** Сменить стиль чарта метрики (ключ — sourceMetricId). */
  onChartStyleChange?: (metricId: string, style: MetricChartStyle) => void;
  /** Группа — для редактора CF на карточке. */
  groupId?: string;
  /** sourceMetricId → templateId (CF пишется в шаблон). */
  metricTemplateIds?: Record<string, string>;
}

/**
 * Сетка KPI-карточек с мультивыбором.
 * Клик по карточке добавляет/убирает метрику из активных для визуализации.
 */
export const GroupKpiGrid = memo(function GroupKpiGrid({
  metrics,
  activeMetricIds,
  recordCount,
  onToggleMetric,
  chartStyleByMetricId,
  onChartStyleChange,
  groupId,
  metricTemplateIds,
}: GroupKpiGridProps) {
  const handleToggle = useCallback((id: string) => {
    onToggleMetric(id);
  }, [onToggleMetric]);

  if (metrics.length === 0) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {metrics.map((metric) => {
        const isActive = activeMetricIds.includes(metric.virtualMetricId);
        const activeIndex = isActive ? activeMetricIds.indexOf(metric.virtualMetricId) : -1;
        const styleKey = metric.sourceMetricId || metric.virtualMetricId;

        return (
          <GroupKpiCard
            key={metric.virtualMetricId}
            metric={metric}
            isActive={isActive}
            activeIndex={activeIndex}
            totalActive={activeMetricIds.length}
            recordCount={recordCount}
            onToggle={handleToggle}
            chartStyle={chartStyleByMetricId?.[styleKey]}
            onChartStyleChange={
              onChartStyleChange
                ? (style) => onChartStyleChange(styleKey, style)
                : undefined
            }
            groupId={groupId}
            metricId={metric.sourceMetricId}
            templateId={metricTemplateIds?.[styleKey]}
          />
        );
      })}
    </div>
  );
});