'use client';
import { useState, useCallback } from 'react';
import type { VirtualMetric } from '@/shared/lib/validators';
import { SortConfig } from './types';
import { ChartType } from '@/shared/lib/types/chart';

/**
 * UI-состояние виджета просмотра группы.
 * Управляет выбором метрик для визуализации, типами графиков и сортировкой.
 *
 * Дефолты («первая метрика активна», «сортировка по первой активной»)
 * ДЕРИВИРУЮТСЯ во время рендера, а не записываются в state эффектами:
 * setState-в-эффекте давал лишний каскадный ререндер и расходился
 * со Strict Mode (react-hooks/set-state-in-effect).
 */
export function useGroupViewState(virtualMetrics: VirtualMetric[]) {
  // null/[] = «пользователь ещё не выбирал» → действует дефолт
  const [selectedMetricIds, setSelectedMetricIds] = useState<string[]>([]);
  const [chartTypes, setChartTypes] = useState<ChartType[]>(['bar', 'radar']);
  const [userSortConfig, setUserSortConfig] = useState<SortConfig | null>(null);

  // Дефолт: первая метрика группы
  const activeMetricIds =
    selectedMetricIds.length > 0
      ? selectedMetricIds
      : virtualMetrics.length > 0
        ? [virtualMetrics[0].id]
        : selectedMetricIds;

  // Дефолт: сортировка по первой активной метрике
  const sortConfig: SortConfig | null =
    userSortConfig ??
    (activeMetricIds.length > 0
      ? { key: activeMetricIds[0], direction: 'desc' }
      : null);

  const handleToggleMetric = useCallback((metricId: string) => {
    setSelectedMetricIds(prev => {
      // База для переключения — эффективный выбор (с учётом дефолта)
      const base =
        prev.length > 0
          ? prev
          : virtualMetrics.length > 0
            ? [virtualMetrics[0].id]
            : prev;
      const isAlready = base.includes(metricId);
      if (isAlready) {
        if (base.length === 1) return base;
        return base.filter(id => id !== metricId);
      }
      return [...base, metricId];
    });
  }, [virtualMetrics]);

  const handleChartTypesChange = useCallback((types: ChartType[]) => {
    setChartTypes(types);
  }, []);

  return {
    activeMetricIds,
    chartTypes,
    sortConfig,
    setSortConfig: setUserSortConfig,
    handleToggleMetric,
    handleChartTypesChange,
  };
}
