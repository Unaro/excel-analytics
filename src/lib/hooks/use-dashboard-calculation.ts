'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useDatasetStore } from '@/entities/dataset';
import { useIndicatorGroupStore } from '@/entities/indicatorGroup';
import { useMetricTemplateStore } from '@/entities/metric';
import { useDashboardStore } from '@/entities/dashboard';
import { useComputedMetricsStore } from '@/entities/metric';
import { computeDashboardMetrics } from '@/app/actions/compute';
import type { HierarchyFilterValue } from '@/types';

const EMPTY_FILTERS: HierarchyFilterValue[] = [];

export function useDashboardCalculation(dashboardId: string) {
  const excelDataLength = useDatasetStore(s => s.getAllData().length);
  const activeDatasetId = useDatasetStore(s => s.activeDatasetId);
  const isComputing = useComputedMetricsStore(s => s.isComputing);
  const computationError = useComputedMetricsStore(s => s.computationError);
  const result = useComputedMetricsStore(s => s.dashboardResults.get(dashboardId));
  
  const dashboard = useDashboardStore(s => s.dashboards.find(d => d.id === dashboardId));
  const hierarchyFilters = dashboard?.hierarchyFilters ?? EMPTY_FILTERS;

  const filtersSignature = useMemo(() => {
    return hierarchyFilters.map(f => `${f.levelId}:${f.value}`).join('|');
  }, [hierarchyFilters]);

  const latestStateRef = useRef({
    dashboard,
    hierarchyFilters,
    excelDataLength,
    activeDatasetId,
    isComputing,
  });

  useEffect(() => {
    latestStateRef.current = {
      dashboard,
      hierarchyFilters,
      excelDataLength,
      activeDatasetId,
      isComputing,
    };
  });

  const calculationRef = useRef(async () => {
    const state = latestStateRef.current;
    if (!state.dashboard || !state.activeDatasetId || state.excelDataLength === 0 || state.isComputing) return;

    const store = useComputedMetricsStore.getState();
    store.setComputingState(true, null);

    try {
      const data = useDatasetStore.getState().getAllData();
      const allGroups = useIndicatorGroupStore.getState().groups;
      const templates = useMetricTemplateStore.getState().templates;

      const computationResult = await computeDashboardMetrics({
        dashboardId,
        data,
        allGroups,
        dashboardGroupsConfig: state.dashboard.indicatorGroups,
        metricTemplates: templates,
        virtualMetrics: state.dashboard.virtualMetrics,
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

  const lastFiltersSigRef = useRef<string | null>(null);
  const lastDataLenRef = useRef(0);

  useEffect(() => {
    const state = latestStateRef.current;
    if (!state.dashboard || state.excelDataLength === 0 || state.isComputing) return;

    const filtersChanged = lastFiltersSigRef.current !== filtersSignature;
    const dataChanged = lastDataLenRef.current !== state.excelDataLength;
    const needsInitialCalc = !result;


    if (filtersChanged || dataChanged || needsInitialCalc) {
      lastFiltersSigRef.current = filtersSignature;
      lastDataLenRef.current = state.excelDataLength;
      calculationRef.current();
    }
  }, [
    dashboard?.id,
    excelDataLength,
    filtersSignature,
    isComputing,
    result?.computedAt
  ]);

  const recalculate = useCallback(async () => {
    await calculationRef.current();
  }, []);

  return { result, isComputing, error: computationError, recalculate };
}