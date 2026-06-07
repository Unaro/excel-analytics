'use client';

import { use, useMemo, useCallback } from 'react';
import { useDashboardStore } from '@/entities/dashboard';
import { useHierarchyTree } from '@/entities/hierarchy';
import { HierarchyTree } from '@/widgets/hierarchy-filter';
import { KPIGrid } from '@/widgets/kpi-grid';
import { DashboardMetricsTable } from '@/widgets/dashboard-metrics-table';
import { ChartsSectionWidget } from '@/widgets/charts-section';
import { ErrorBoundary } from '@/shared/ui/error-boundary';
import { useShallow } from 'zustand/react/shallow';
import { DashboardHeader } from './DashboardHeader';
import { DashboardStats } from './DashboardStats';
import { DashboardNotFound } from './DashboardNotFound';
import { DatasetUnavailable } from './DatasetUnavailable';
import { useDashboardOrphanCleanup } from '../model';
import { useDashboardDatasetSync } from '../model';
import { useDashboardComputation } from '../model';
import { useDashboardViewState } from '../model';
import { flattenDashboardResult } from '@/entities/metric/lib/flatten-dashboard-result';
import { Loader2 } from 'lucide-react';

interface DashboardViewContentProps {
  params: Promise<{ id: string }>;
}

/**
 * Приватный оркестратор страницы просмотра дашборда.
 *
 * Отвечает за:
 *  1. Парсинг `params`
 *  2. Вызов features-хуков (computation, dataset-sync, orphan-cleanup)
 *  3. Чтение данных дашборда из store
 *  4. Управление UI-состоянием через `useDashboardViewState`
 *  5. Композицию вложенных виджетов (HierarchyTree, KPIGrid, Charts, Table)
 *  6. Обработку edge cases (dashboard not found, dataset unavailable)
 *
 * НЕ должен экспортироваться наружу — используется только DashboardViewWidget.
 */
export function DashboardViewContent({ params }: DashboardViewContentProps) {
  const { id: dashboardId } = use(params);

  // Одноразовая очистка устаревших привязок групп
  useDashboardOrphanCleanup(dashboardId, true);

  // Синхронизация датасета, привязанного к дашборду
  const {
    boundDataset,
    hasData,
    isPgSource,
    pgStatus,
    isSyncing,
    refreshingDataset,
    refreshDataset,
  } = useDashboardDatasetSync(dashboardId);

  // Вычисление метрик дашборда
  const { result, isComputing, error, recalculate } =
    useDashboardComputation(dashboardId);

  // Данные дашборда
  const dashboard = useDashboardStore(
    useShallow(s => s.dashboards.find(d => d.id === dashboardId))
  );

  const { currentPath } = useHierarchyTree(dashboardId);

  const hierarchyFilters = useDashboardStore(
    useShallow(
      useCallback(
        s => s.dashboards.find(d => d.id === dashboardId)?.hierarchyFilters ?? [],
        [dashboardId]
      )
    )
  );

  // UI-состояние чартов и таблицы
  const dashboardVirtualMetrics = dashboard?.virtualMetrics ?? [];
  const viewState = useDashboardViewState(dashboardVirtualMetrics);

  // Плоские данные для ChartsSectionWidget
  const { breakdown, virtualMetrics } = useMemo(
    () => flattenDashboardResult(result, dashboardVirtualMetrics),
    [result, dashboardVirtualMetrics]
  );

  // Edge case: дашборд не найден
  if (!dashboard) {
    return <DashboardNotFound />;
  }

  // Edge case: датасет недоступен
  if (!boundDataset && dashboard.datasetId) {
    return <DatasetUnavailable dashboardName={dashboard.name} />;
  }

  if (boundDataset?.sourceType === 'file' && boundDataset.engineStatus === 'error') {
    return <DatasetUnavailable dashboardName={dashboard.name} />;
  }

  if (boundDataset?.sourceType === 'postgres' && !hasData) {
    return <DatasetUnavailable dashboardName={dashboard.name} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 space-y-6">
      <DashboardHeader
        dashboard={dashboard}
        datasetStatus={{
          dataset: boundDataset,
          isPgSource,
          pgStatus,
          isSyncing,
          isRefreshing: refreshingDataset,
          onRefresh: refreshDataset,
        }}
        computationStatus={{
          isComputing,
          computedAt: result?.computedAt,
          onRecalculate: recalculate,
        }}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3 space-y-2">
          <ErrorBoundary label="Дерево иерархии">
            <HierarchyTree
              dashboardId={dashboardId}
              currentFilters={hierarchyFilters}
            />
          </ErrorBoundary>
          <DashboardStats result={result} />
        </div>

        <div className="lg:col-span-9 space-y-6">
          <ErrorBoundary label="KPI Grid" onReset={recalculate}>
            <KPIGrid
              dashboardId={dashboardId}
              widgets={dashboard.kpiWidgets || []}
              currentFilters={hierarchyFilters}
              isEditMode={true}
            />
          </ErrorBoundary>

          {result && breakdown.length > 0 && (
            <ErrorBoundary label="Графики" onReset={recalculate}>
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                <ChartsSectionWidget
                  breakdown={breakdown}
                  virtualMetrics={virtualMetrics}
                  metricConfigs={dashboardVirtualMetrics}
                  activeMetricIds={viewState.activeMetricIds}
                  chartTypes={viewState.chartTypes}
                  onActiveMetricIdsChange={viewState.setActiveMetricIds}
                  onChartTypesChange={viewState.setChartTypes}
                  mode="single"
                />
              </div>
            </ErrorBoundary>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-4 rounded-xl">
              <h3 className="font-semibold text-sm">Ошибка расчета</h3>
              <p className="text-sm mt-1 opacity-90">{error}</p>
            </div>
          )}

          <ErrorBoundary label="Таблица метрик" onReset={recalculate}>
            <DashboardMetricsTable
              dashboardId={dashboardId}
              groups={result?.groups || []}
              loading={isComputing}
              hiddenMetricIds={viewState.hiddenMetricIds}
              onToggleMetricVisibility={viewState.toggleMetricVisibility}
              getGroupHref={groupId =>
                `/groups/${groupId}?filters=${encodeURIComponent(JSON.stringify(currentPath))}`
              }
              className="mt-6"
            />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}