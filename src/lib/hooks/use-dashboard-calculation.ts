import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useDatasetStore } from '@/entities/dataset';
import { useIndicatorGroupStore } from '@/entities/indicatorGroup';
import { useMetricTemplateStore } from '@/entities/metric';
import { useDashboardStore } from '@/entities/dashboard';
import { useComputedMetricsStore } from '@/entities/metric';
import { computeDashboardMetrics } from '@/app/actions/compute';
import { useShallow } from 'zustand/react/shallow';

export function useDashboardCalculation(dashboardId: string) {
  const excelData = useDatasetStore(s => s.getAllData());
  
  const allGroups = useIndicatorGroupStore(useShallow(s => s.groups));
  const templates = useMetricTemplateStore(useShallow(s => s.templates));

  const { dashboard, hierarchyFilters } = useDashboardStore(useShallow(s => {
    const d = s.getDashboard(dashboardId);
    return { dashboard: d, hierarchyFilters: d?.hierarchyFilters || [] };
  }));

  const { setComputingState, setDashboardResult, result, isComputing, computationError } = 
    useComputedMetricsStore(useShallow((s) => ({
      setComputingState: s.setComputingState,
      setDashboardResult: s.setDashboardResult,
      result: s.dashboardResults.get(dashboardId),
      isComputing: s.isComputing,
      computationError: s.computationError
    })));

  const runCalculation = useCallback(async () => {
    if (!dashboard || excelData.length === 0) return;
    setComputingState(true, null);
    try {
      const computationResult = await computeDashboardMetrics({
        dashboardId,
        data: excelData,
        allGroups,
        dashboardGroupsConfig: dashboard.indicatorGroups,
        metricTemplates: templates,
        virtualMetrics: dashboard.virtualMetrics,
        filters: dashboard.hierarchyFilters,
      });
      setDashboardResult(dashboardId, computationResult);
      setComputingState(false, null);
    } catch (err) {
      console.error("Calculation error:", err);
      setComputingState(false, err instanceof Error ? err.message : 'Unknown calculation error');
    }
  }, [dashboard, excelData, allGroups, templates, dashboardId, setComputingState, setDashboardResult]);

  const lastFiltersRef = useRef(hierarchyFilters);
  const lastDataLengthRef = useRef(excelData.length);

  useEffect(() => {
    if (!dashboard || excelData.length === 0 || isComputing) return;

    // Сравниваем фильтры и объём данных с последним запуском
    const filtersChanged = JSON.stringify(lastFiltersRef.current) !== JSON.stringify(hierarchyFilters);
    const dataChanged = lastDataLengthRef.current !== excelData.length;

    if (filtersChanged || dataChanged || !result) {
      lastFiltersRef.current = hierarchyFilters;
      lastDataLengthRef.current = excelData.length;
      runCalculation();
    }
  }, [dashboard, excelData.length, hierarchyFilters, result, isComputing, runCalculation]);

  return { result, isComputing, error: computationError, recalculate: runCalculation };
}