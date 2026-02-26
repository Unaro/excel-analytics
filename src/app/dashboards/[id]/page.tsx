'use client';

import { Suspense, use, useState } from 'react';
import Link from 'next/link';
import { useDashboardCalculation } from '@/lib/hooks/use-dashboard-calculation';
import { useHierarchyTree } from '@/lib/hooks/use-hierarchy-tree';
import { ChartsSection } from '@/widgets/ChartsSection';
import { useDashboardStore } from '@/entities/dashboard';
import { useStoreHydration } from '@/lib/hooks/use-store-hydration';
import { HierarchyTree } from '@/widgets/HierarchyFilter';
import {
  ArrowLeft,
  Edit,
  RotateCw,
  Filter,
  X,
  Layers,
  Loader2,
  Database
} from 'lucide-react';
import { MetricCell } from '@/entities/metric/ui/metric-cell';
import { MetricsSelector } from '@/features/ConfigureTableMetric/metrics-selector';
import { MetricConfigPopover } from '@/features/ConfigureTableMetric';
import { useExcelDataStore } from '@/entities/excelData';
import { AddKPIDialog } from '@/features/AddKpiWidget';
import { KPIGrid } from '@/widgets/KpiGrid';
import { LoadingScreen } from '@/shared/ui/loading-screen';

function DashboardContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const dashboardId = id;

  const [hiddenMetricIds, setHiddenMetricIds] = useState<string[]>([]);

  const toggleMetricVisibility = (id: string) => {
    setHiddenMetricIds(prev =>
      prev.includes(id)
        ? prev.filter(mId => mId !== id)
        : [...prev, id]
    );
  };

  const hydrated = useStoreHydration();
  const dashboard = useDashboardStore(s => s.getDashboard(dashboardId));
  const hasData = useExcelDataStore(s => s.hasData());
  const { currentPath } = useHierarchyTree(dashboardId);
  const { result, isComputing, error, recalculate } = useDashboardCalculation(dashboardId);

  const visibleMetrics = result?.virtualMetrics.filter(
    vm => !hiddenMetricIds.includes(vm.id)
  ) || [];

  if (!hydrated) {
    return <LoadingScreen message="Загрузка системы..." />;
  }

  if (!dashboard) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-950 gap-4">
        <div className="text-xl font-semibold text-gray-900 dark:text-white">Дашборд не найден</div>
        <Link href="/dashboards" className="text-indigo-600 hover:underline">
          Вернуться к списку
        </Link>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-950 p-6">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-dashed border-gray-300 dark:border-slate-700 rounded-2xl p-8 text-center shadow-sm">
          <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <Database size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Данные отсутствуют</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
            Для работы с дашбордом <strong>&quot;{dashboard.name}&quot;</strong> необходимо загрузить исходный файл (Excel/CSV).
          </p>

          <div className="flex flex-col gap-3">
            <Link
              href="/setup"
              className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <Database size={18} />
              Загрузить датасет
            </Link>
            <Link
              href="/dashboards"
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-slate-500 dark:hover:text-slate-300"
            >
              Вернуться назад
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 p-6 space-y-6">

      {/* --- ХЕДЕР --- */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800">
        <div className="flex items-center gap-4">
          <Link href="/dashboards" className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-500 dark:text-slate-400 transition">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{dashboard.name}</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">{dashboard.description || 'Аналитическая таблица'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-xs font-mono text-gray-400 dark:text-slate-500 mr-2">
            {isComputing ? (
              <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 animate-pulse">
                <Loader2 size={12} className="animate-spin" /> Вычисление...
              </span>
            ) : result ? (
              <span>Обновлено: {new Date(result.computedAt).toLocaleTimeString()}</span>
            ) : null}
          </div>

          <AddKPIDialog dashboardId={dashboardId} />

          <button
            onClick={recalculate}
            disabled={isComputing}
            className="p-2 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-md transition disabled:opacity-50"
            title="Обновить данные"
          >
            <RotateCw size={18} className={isComputing ? 'animate-spin' : ''} />
          </button>

          {result && (
            <MetricsSelector
              metrics={result.virtualMetrics}
              hiddenMetricIds={hiddenMetricIds}
              onToggleMetric={toggleMetricVisibility}
            />
          )}

          <Link
            href={`/dashboards/${dashboardId}/edit`}
            className="flex items-center gap-2 bg-slate-900 dark:bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-slate-800 dark:hover:bg-indigo-700 transition text-sm font-medium shadow-sm"
          >
            <Edit size={16} /> Редактировать
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">

        {/* --- ЛЕВАЯ КОЛОНКА: Фильтры --- */}
        <div className="lg:col-span-3 space-y-2">
          <HierarchyTree
             dashboardId={dashboardId}
             currentFilters={dashboard.hierarchyFilters}
          />

          {result && (
             <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm">
               <div className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">Статистика выборки</div>
               <div className="text-2xl font-mono text-slate-700 dark:text-slate-200">
                 {result.totalRecords.toLocaleString()}
               </div>
               <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">записей обработано</div>
             </div>
          )}
        </div>

        {/* --- ПРАВАЯ КОЛОНКА: Данные --- */}
        <div className="lg:col-span-9 space-y-6">

          <KPIGrid
             dashboardId={dashboardId}
             widgets={dashboard.kpiWidgets || []}
             currentFilters={dashboard.hierarchyFilters}
             isEditMode={true}
          />

          {result && (
             <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
               <ChartsSection result={result} />
             </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-4 rounded-xl flex items-start gap-3">
              <div className="p-1 bg-red-100 dark:bg-red-900/50 rounded-full">
                <X size={16} />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Ошибка расчета</h3>
                <p className="text-sm mt-1 opacity-90">{error}</p>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden relative min-h-[300px]">

            {isComputing && (
              <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-[2px] z-20 flex items-center justify-center transition-opacity">
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-2xl border border-gray-100 dark:border-slate-700 flex flex-col items-center gap-3">
                  <Loader2 className="animate-spin text-indigo-600 dark:text-indigo-400" size={32} />
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Пересчет показателей...</span>
                </div>
              </div>
            )}

            <div className="overflow-x-auto custom-scrollbar">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800">
                <thead className="bg-gray-50 dark:bg-slate-800/50">
                  <tr>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 z-10 w-[250px] shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]">
                      <div className="flex items-center gap-2">
                        <Layers size={14} className="text-indigo-500" />
                        Показатель
                      </div>
                    </th>

                    {visibleMetrics.map((vmResult) => {
                      const liveMetric = dashboard?.virtualMetrics.find(m => m.id === vmResult.id) || vmResult;

                      return (
                      <th
                        key={liveMetric.id}
                        scope="col"
                        className="px-6 py-4 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider min-w-[150px] group/th relative"
                      >
                          <div className="flex justify-end gap-2 items-center">

                            <div className="mt-0.5">
                              <MetricConfigPopover dashboardId={dashboardId} metric={liveMetric} />
                            </div>

                            <div className="flex flex-col items-end">
                              <span>{liveMetric.name}</span>
                              {liveMetric.unit && <span className="text-[10px] text-slate-400 lowercase bg-slate-100 dark:bg-slate-800 px-1.5 rounded mt-0.5">{liveMetric.unit}</span>}
                            </div>
                          </div>

                          {liveMetric.colorConfig?.rules && (
                            <div className="absolute bottom-2 right-6 w-1 h-1 rounded-full bg-indigo-500" />
                          )}
                      </th>)}
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-100 dark:divide-slate-800/50">
                  {!result && !isComputing && (
                    <tr>
                      <td colSpan={100} className="px-6 py-20 text-center text-slate-400 dark:text-slate-600">
                        <div className="flex flex-col items-center gap-2">
                          <Filter size={32} className="opacity-20" />
                          <span>Данные не рассчитаны</span>
                        </div>
                      </td>
                    </tr>
                  )}

                  {result?.groups.map((group) => (
                    <tr
                      key={group.groupId}
                      className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 group"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-slate-100 sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-indigo-50/30 dark:group-hover:bg-slate-900/50 border-r border-gray-100 dark:border-slate-800 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]">
                        <Link
                          href={`/groups/${group.groupId}?filters=${encodeURIComponent(JSON.stringify(currentPath))}`}
                          className="hover:text-indigo-600 dark:hover:text-indigo-400 underline decoration-dashed underline-offset-4 decoration-slate-300"
                        >
                          {group.groupName}
                        </Link>
                      </td>

                      {group.virtualMetrics
                        .filter(val => !hiddenMetricIds.includes(val.virtualMetricId))
                        .map((metricVal) => {
                          const metricConfig = dashboard?.virtualMetrics.find(
                              m => m.id === metricVal.virtualMetricId
                          );

                          const finalConfig = metricConfig || result.virtualMetrics.find(m => m.id === metricVal.virtualMetricId);

                          if (!finalConfig) return <td key={metricVal.virtualMetricId} />;
                          if (!metricConfig) return <td key={metricVal.virtualMetricId} />;

                          return (
                            <td key={metricVal.virtualMetricId} className="px-6 py-4 whitespace-nowrap text-sm text-right border-l border-transparent hover:border-slate-100 dark:hover:border-slate-800">
                              <MetricCell
                                value={metricVal.value}
                                formattedValue={metricVal.formattedValue}
                                metric={finalConfig}
                              />
                            </td>
                          );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default function DashboardPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingScreen message="Загрузка дашборда..." />}>
      <DashboardContent params={params} />
    </Suspense>
  );
}
