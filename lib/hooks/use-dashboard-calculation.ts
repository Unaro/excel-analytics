// lib/hooks/use-dashboard-calculation.ts
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useExcelDataStore } from '@/lib/stores/excel-data-store';
import { useIndicatorGroupStore } from '@/lib/stores/indicator-group-store';
import { useMetricTemplateStore } from '@/lib/stores/metric-template-store';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { useComputedMetricsStore } from '@/lib/stores/computed-metrics-store';
import { computeDashboardMetrics } from '@/app/actions/compute';

export function useDashboardCalculation(dashboardId: string) {
  // ИСПРАВЛЕНИЕ: Берем сырые листы
  const sheets = useExcelDataStore(s => s.data);
  
  // Мемоизируем плоский массив
  const excelData = useMemo(() => {
    if (!sheets) return [];
    return sheets.flatMap(sheet => sheet.rows);
  }, [sheets]);

  const allGroups = useIndicatorGroupStore(s => s.groups);
  const templates = useMetricTemplateStore(s => s.templates);
  const dashboard = useDashboardStore(s => s.getDashboard(dashboardId));
  
  const { 
    setComputingState, 
    setDashboardResult, 
    getDashboardResult,
    isComputing,
    computationError 
  } = useComputedMetricsStore();

  const result = getDashboardResult(dashboardId);

  const runCalculation = useCallback(async () => {
    if (!dashboard) return;

    if (excelData.length === 0) {
      // Не считаем ошибкой, если данных нет, просто выходим или ставим статус
      return; 
    }

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
  }, [
    dashboard, 
    excelData, 
    allGroups, 
    templates, 
    dashboardId, 
    setComputingState, 
    setDashboardResult
  ]);

  useEffect(() => {
    if (!dashboard || excelData.length === 0) return;
    
    const hasChanges = 
      !result || 
      result.hierarchyFilters.length !== dashboard.hierarchyFilters.length ||
      (dashboard.hierarchyFilters.length > 0 && 
       result.hierarchyFilters[result.hierarchyFilters.length - 1].value !== 
       dashboard.hierarchyFilters[dashboard.hierarchyFilters.length - 1].value);

    if (hasChanges && !isComputing) {
      runCalculation();
    }
  }, [
    dashboard?.hierarchyFilters, 
    dashboard?.indicatorGroups,
    dashboard?.virtualMetrics,
    excelData,
    result,
    isComputing,
    runCalculation
  ]);

  return {
    result,
    isComputing,
    error: computationError,
    recalculate: runCalculation
  };
}