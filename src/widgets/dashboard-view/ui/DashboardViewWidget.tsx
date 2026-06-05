'use client';
import { use } from 'react';
import Link from 'next/link';
import { useState, useCallback, useMemo } from 'react';
import { useDashboardStore } from '@/entities/dashboard';
import { ClientOnly } from '@/shared/lib/hydration'; // ← ПРАВИЛЬНЫЙ СПОСОБ
import { useDashboardComputation } from '@/features/compute-dashboard';
import { useDashboardDatasetSync, useDashboardOrphanCleanup } from '@/features/dashboard-dataset-sync';
import { flattenDashboardResult } from '@/features/charts-data';
import { useHierarchyTree } from '@/entities/hierarchy/lib/hooks/use-hierarchy-tree';
import { HierarchyTree } from '@/widgets/hierarchy-filter';
import { KPIGrid } from '@/widgets/kpi-grid';
import { DashboardMetricsTable } from '@/widgets/dashboard-metrics-table';
import { DashboardHeader } from './DashboardHeader';
import { DashboardStats } from './DashboardStats';
import { ErrorBoundary } from '@/shared/ui/error-boundary';
import { LoadingScreen } from '@/shared/ui/loading-screen';
import { AlertCircle } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { ChartsSectionWidget } from '@/widgets/charts-section/ui/ChartsSectionWidget';

interface DashboardViewWidgetProps {
  params: Promise<{ id: string }>;
}

/**
 * Обёртка с ClientOnly для предотвращения hydration mismatch.
 * Сервер и клиент оба рендерят <LoadingScreen /> при первом рендере.
 * После mount клиент рендерит DashboardViewContent.
 */
export function DashboardViewWidget({ params }: DashboardViewWidgetProps) {
  return (
    <ClientOnly fallback={<LoadingScreen message="Загрузка дашборда..." />}>
      <DashboardViewContent params={params} />
    </ClientOnly>
  );
}

function DashboardViewContent({ params }: DashboardViewWidgetProps) {
  const { id: dashboardId } = use(params);

  // ─── Orphan cleanup (один раз при монтировании) ───
  useDashboardOrphanCleanup(dashboardId, true);

  // ─── Синхронизация датасета ───
  const {
    boundDataset,
    hasData,
    isPgSource,
    pgStatus,
    isSyncing,
    refreshingDataset,
    refreshDataset,
  } = useDashboardDatasetSync(dashboardId);

  // ─── Вычисления ───
  const { result, isComputing, error, recalculate } = useDashboardComputation(dashboardId);

  // ─── Данные дашборда ───
  const dashboard = useDashboardStore(
    useShallow(s => s.dashboards.find(d => d.id === dashboardId))
  );
  const { currentPath } = useHierarchyTree(dashboardId);
  const hierarchyFilters = useDashboardStore(
    useShallow(
      useCallback(
        (s) => s.dashboards.find(d => d.id === dashboardId)?.hierarchyFilters ?? [],
        [dashboardId]
      )
    )
  );

  // ─── Локальное UI-состояние для чартов ───
  const dashboardVirtualMetrics = dashboard?.virtualMetrics ?? [];
  const [activeMetricIds, setActiveMetricIds] = useState<string[]>(() =>
    dashboardVirtualMetrics.length > 0 ? [dashboardVirtualMetrics[0].id] : []
  );
  // Для single-режима: radio (только один тип)
  const [chartTypes, setChartTypes] = useState<('bar' | 'radar')[]>(['bar']);
  const [hiddenMetricIds, setHiddenMetricIds] = useState<string[]>([]);

  const toggleMetricVisibility = useCallback((id: string) => {
    setHiddenMetricIds(prev =>
      prev.includes(id) ? prev.filter(mId => mId !== id) : [...prev, id]
    );
  }, []);

  // ─── Плоские данные для ChartsSectionWidget ───
  const { breakdown, virtualMetrics } = useMemo(
    () => flattenDashboardResult(result, dashboardVirtualMetrics),
    [result, dashboardVirtualMetrics]
  );

  // ─── Дашборд не найден ───
  if (!dashboard) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-950 gap-4">
        <div className="text-xl font-semibold text-gray-900 dark:text-white">
          Дашборд не найден
        </div>
        <Link href="/dashboards" className="text-indigo-600 hover:underline">
          Вернуться к списку
        </Link>
      </div>
    );
  }

  // ─── Датасет недоступен ───
  if (!hasData && dashboard.datasetId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950 p-6">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-dashed border-amber-300 dark:border-amber-700 rounded-2xl p-8 text-center shadow-sm">
          <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Датасет недоступен
          </h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
            Дашборд <strong>&quot;{dashboard.name}&quot;</strong> привязан к датасету,
            который был удален или не загружен.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/setup"
              className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Загрузить датасет
            </Link>
            <Link
              href="/dashboards"
              className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-sm"
            >
              Вернуться к списку
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 space-y-6">
      {/* Хедер */}
      <DashboardHeader
        dashboard={dashboard}
        boundDataset={boundDataset}
        isComputing={isComputing}
        isSyncing={isSyncing}
        isPgSource={isPgSource}
        pgStatus={pgStatus}
        refreshingDataset={refreshingDataset}
        computedAt={result?.computedAt}
        onRecalculate={recalculate}
        onRefreshDataset={refreshDataset}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
        {/* Левая колонка: Фильтры */}
        <div className="lg:col-span-3 space-y-2">
          <ErrorBoundary label="Дерево иерархии">
            <HierarchyTree
              dashboardId={dashboardId}
              currentFilters={hierarchyFilters}
            />
          </ErrorBoundary>
          <DashboardStats result={result} />
        </div>

        {/* Правая колонка: Данные */}
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
                  activeMetricIds={activeMetricIds}
                  chartTypes={chartTypes}
                  onActiveMetricIdsChange={setActiveMetricIds}
                  onChartTypesChange={setChartTypes}
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
              hiddenMetricIds={hiddenMetricIds}
              onToggleMetricVisibility={toggleMetricVisibility}
              getGroupHref={(groupId) =>
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