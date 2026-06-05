'use client';
import { useState, useCallback, useEffect } from 'react';
import type { VirtualMetric } from '@/shared/lib/validators';
import { SortConfig } from './types';
import { ChartType } from '@/entities/dashboard/model/types';

/**
 * UI-состояние виджета просмотра группы.
 * Управляет выбором метрик для визуализации, типами графиков и сортировкой.
 */
export function useGroupViewState(virtualMetrics: VirtualMetric[]) {
  const [activeMetricIds, setActiveMetricIds] = useState<string[]>([]);
  const [chartTypes, setChartTypes] = useState<ChartType[]>(['bar', 'radar']);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  // Авто-выбор первой метрики при загрузке группы
  useEffect(() => {
    if (virtualMetrics.length > 0 && activeMetricIds.length === 0) {
      setActiveMetricIds([virtualMetrics[0].id]);
    }
  }, [virtualMetrics]);

  // Авто-установка сортировки по первой активной метрике
  useEffect(() => {
    if (sortConfig === null && activeMetricIds.length > 0) {
      setSortConfig({ key: activeMetricIds[0], direction: 'desc' });
    }
  }, [activeMetricIds, sortConfig]);

  const handleToggleMetric = useCallback((metricId: string) => {
    setActiveMetricIds(prev => {
      const isAlready = prev.includes(metricId);
      if (isAlready) {
        if (prev.length === 1) return prev;
        return prev.filter(id => id !== metricId);
      }
      return [...prev, metricId];
    });
  }, []);

  const handleChartTypesChange = useCallback((types: ChartType[]) => {
    setChartTypes(types);
  }, []);

  return {
    activeMetricIds,
    chartTypes,
    sortConfig,
    setSortConfig,
    handleToggleMetric,
    handleChartTypesChange,
  };
}