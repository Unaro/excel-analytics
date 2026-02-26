// lib/hooks/use-dashboard-calculation.ts
import { useCallback, useEffect, useMemo } from 'react';
import { useExcelDataStore } from '@/entities/excelData';
import { useIndicatorGroupStore } from '@/entities/indicatorGroup';
import { useMetricTemplateStore } from '@/entities/metric';
import { useDashboardStore } from '@/entities/dashboard';
import { useComputedMetricsStore } from '@/entities/metric';
import { computeDashboardMetrics } from '@/app/actions/compute';
import { useShallow } from 'zustand/react/shallow';


export function useDashboardCalculation(dashboardId: string) {
  // ИСПРАВЛЕНИЕ: Берем сырые листы
  const sheets = useExcelDataStore(s => s.data);
  
  // Мемоизируем плоский массив
  const excelData = useMemo(() => {
    if (!sheets) return [];
    return sheets.flatMap(sheet => sheet.rows);
  }, [sheets]);

  const allGroups = useIndicatorGroupStore(useShallow(s => s.groups));
  const templates = useMetricTemplateStore(useShallow(s => s.templates));
  const dashboard = useDashboardStore(s => s.getDashboard(dashboardId));
  

  // Стор вычислений
  const { 
    setComputingState, 
    setDashboardResult, 
    result,
    isComputing,
    computationError 
  } = useComputedMetricsStore(useShallow((s) => ({
    setComputingState: s.setComputingState,
    setDashboardResult: s.setDashboardResult,
    result: s.dashboardResults.get(dashboardId),
    isComputing: s.isComputing,
    computationError: s.computationError
  })));

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
    dashboard,
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