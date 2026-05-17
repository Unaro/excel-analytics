'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useDatasetStore } from '@/entities/dataset';
import { useIndicatorGroupStore } from '@/entities/indicatorGroup';
import { useMetricTemplateStore } from '@/entities/metric';
import { useDashboardStore } from '@/entities/dashboard';
import { useComputedMetricsStore } from '@/entities/metric';
import { computeDashboardMetrics } from '@/app/actions/compute';
import type { HierarchyFilterValue, DashboardComputationResult } from '@/types';

// Стабильная пустая ссылка (создается 1 раз при загрузке модуля)
const EMPTY_FILTERS: HierarchyFilterValue[] = [];

export interface UseDashboardCalculationReturn {
  result: DashboardComputationResult | undefined;
  isComputing: boolean;
  error: string | null;
  recalculate: () => Promise<void>;
}

export function useDashboardCalculation(dashboardId: string): UseDashboardCalculationReturn {
  // 1. Селекторы ТОЛЬКО примитивов. Не вызывают ререндер при изменении объектов.
  const dataLength = useDatasetStore(s => s.getAllData().length);
  const activeDatasetId = useDatasetStore(s => s.activeDatasetId);
  const isComputing = useComputedMetricsStore(s => s.isComputing);
  const computationError = useComputedMetricsStore(s => s.computationError);
  const result = useComputedMetricsStore(s => s.dashboardResults.get(dashboardId));

  // Стабильные селекторы дашборда
  const dashboard = useDashboardStore(s => s.dashboards.find(d => d.id === dashboardId));
  const hierarchyFilters = dashboard?.hierarchyFilters ?? EMPTY_FILTERS;
  const indicatorGroups = dashboard?.indicatorGroups ?? [];
  const virtualMetrics = dashboard?.virtualMetrics ?? [];

  // 2. Реф для хранения свежего состояния без изменения ссылки функции
  const latestStateRef = useRef({
    dashboard,
    indicatorGroups,
    virtualMetrics,
    hierarchyFilters,
    dataLength,
    activeDatasetId,
    isComputing
  });

  // Синхронизируем реф после каждого рендера
  useEffect(() => {
    latestStateRef.current = {
      dashboard, indicatorGroups, virtualMetrics, hierarchyFilters,
      dataLength, activeDatasetId, isComputing
    };
  });

  // 3. Функция расчета (ссылка НЕ меняется никогда)
  const calculationRef = useRef(async () => {
    const state = latestStateRef.current;
    if (!state.dashboard || !state.activeDatasetId || state.dataLength === 0 || state.isComputing) return;

    const store = useComputedMetricsStore.getState();
    store.setComputingState(true, null);

    try {
      // Берем актуальные данные напрямую из сторов в момент вызова
      const data = useDatasetStore.getState().getAllData();
      const allGroups = useIndicatorGroupStore.getState().groups;
      const templates = useMetricTemplateStore.getState().templates;

      const computationResult = await computeDashboardMetrics({
        dashboardId,
        data,
        allGroups,
        dashboardGroupsConfig: state.indicatorGroups,
        metricTemplates: templates,
        virtualMetrics: state.virtualMetrics,
        filters: state.hierarchyFilters,
      });

      store.setDashboardResult(dashboardId, computationResult);
      store.setComputingState(false, null);
    } catch (err) {
      console.error("[Calculation] Error:", err);
      const msg = err instanceof Error ? err.message : 'Unknown calculation error';
      store.setComputingState(false, msg);
    }
  });

  // 4. Рефы для отслеживания изменений БЕЗ добавления в deps
  const lastFiltersStrRef = useRef<string | null>(null);
  const lastDataLenRef = useRef(0);

  // 5. Эффект запуска. Зависит ТОЛЬКО от примитивов.
  useEffect(() => {
    const state = latestStateRef.current;
    if (!state.dashboard || state.dataLength === 0 || state.isComputing) return;

    const currentFiltersStr = JSON.stringify(state.hierarchyFilters);
    const filtersChanged = lastFiltersStrRef.current !== currentFiltersStr;
    const dataChanged = lastDataLenRef.current !== state.dataLength;
    const needsInitialCalc = !result;

    // 🔥 КЛЮЧЕВОЙ МОМЕНТ: Обновляем рефы ДО вызова расчета.
    // Это гарантирует, что когда result изменится и вызовет ре-рендер,
    // эти флаги будут false, и цикл прервется.
    if (filtersChanged || dataChanged || needsInitialCalc) {
      lastFiltersStrRef.current = currentFiltersStr;
      lastDataLenRef.current = state.dataLength;
      calculationRef.current();
    }
  }, [
    dashboard?.id, 
    dataLength, 
    hierarchyFilters.length, 
    isComputing, 
    result?.computedAt // Примитив вместо объекта result
  ]);

  const recalculate = useCallback(async () => {
    await calculationRef.current();
  }, []);

  return { result, isComputing, error: computationError, recalculate };
}