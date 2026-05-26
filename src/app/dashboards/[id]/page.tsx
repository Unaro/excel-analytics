'use client';
import { Suspense, use, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChartsSection } from '@/widgets/ChartsSection';
import { useDashboardStore } from '@/entities/dashboard';
import { useDatasetStore } from '@/entities/dataset';
import { useStoreHydration } from '@/lib/hooks/use-store-hydration';
import { HierarchyTree } from '@/widgets/HierarchyFilter';
import {
  ArrowLeft, Edit, RotateCw, RefreshCw, X, Loader2, Database, AlertCircle, FileSpreadsheet
} from 'lucide-react';
import { AddKPIDialog } from '@/features/AddKpiWidget';
import { KPIGrid } from '@/widgets/KpiGrid';
import { LoadingScreen } from '@/shared/ui/loading-screen';
import { Button } from '@/shared/ui/button';
import { useShallow } from 'zustand/react/shallow';
import { toast } from 'sonner';
import { refreshPgDataset } from '@/entities/dataset/model/sync-engine';
import { DashboardMetricsTable } from '@/widgets/DashboardMetricsTable';
import { useDashboardCalculation } from '@/features/computation/model/use-dashboard-calculation';
import { useHierarchyTree } from '@/entities/hierarchy/lib/hooks/use-hierarchy-tree';

function DashboardContent({ params }: { params: Promise<{ id: string }> }) {
  const { id: dashboardId } = use(params);
  const router = useRouter();
  const hydrated = useStoreHydration();
  
  const dashboard = useDashboardStore(
    useShallow(s => s.dashboards.find(d => d.id === dashboardId))
  );
  const dashboardDatasetId = useDashboardStore(s => s.getDashboard(dashboardId)?.datasetId);
  const activeDatasetId = useDatasetStore(s => s.activeDatasetId);
  const switchDataset = useDatasetStore(s => s.switchDataset);
  const isSyncing = useDatasetStore(s => s.isSyncing);

  useEffect(() => {
    if (!hydrated) return;
    if (!dashboard?.datasetId) return;
    if (activeDatasetId === dashboard.datasetId) return;
    switchDataset(dashboard.datasetId);
  }, [hydrated, dashboard?.datasetId, activeDatasetId, switchDataset]);

  const boundDataset = useDatasetStore(useShallow(s =>
    dashboardDatasetId ? s.datasets[dashboardDatasetId] : null
  ));
  const hasData = !!boundDataset?.rows && boundDataset.rows.length > 0;
  

  const isPgSource = boundDataset?.sourceType === 'postgres';
  const pgStatus = boundDataset?.pgStatus;
  const [refreshingDataset, setRefreshingDataset] = useState(false);

  const handleRefreshDataset = async () => {
    if (!dashboardDatasetId || !isPgSource) return;
    setRefreshingDataset(true);
    try {
      const res = await refreshPgDataset(dashboardDatasetId);
      if (res?.success) {
        router.refresh(); 
      } else {
        toast.error('Не удалось обновить датасет');
      }
    } catch (err) {
      console.error('[Dashboard] Dataset refresh failed:', err);
      toast.error('Ошибка синхронизации');
    } finally {
      setRefreshingDataset(false);
    }
  };

  const { currentPath } = useHierarchyTree(dashboardId);
  const { result, isComputing, error, recalculate } = useDashboardCalculation(dashboardId);
  const [hiddenMetricIds, setHiddenMetricIds] = useState<string[]>([]);
  
  const toggleMetricVisibility = (id: string) => {
    setHiddenMetricIds(prev => prev.includes(id) ? prev.filter(mId => mId !== id) : [...prev, id]);
  };

  if (!hydrated) return <LoadingScreen message="Загрузка системы..." />;
  if (!dashboard) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-950 gap-4">
        <div className="text-xl font-semibold text-gray-900 dark:text-white">Дашборд не найден</div>
        <Link href="/dashboards" className="text-indigo-600 hover:underline">Вернуться к списку</Link>
      </div>
    );
  }
  if (!hasData && dashboard.datasetId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-950 p-6">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-dashed border-amber-300 dark:border-amber-700 rounded-2xl p-8 text-center shadow-sm">
          <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Датасет недоступен</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
            Дашборд <strong>"{dashboard.name}"</strong> привязан к датасету, который был удален или не загружен.
          </p>
          <div className="flex flex-col gap-3">
            <Link href="/setup" className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
              <Database size={18} /> Загрузить датасет
            </Link>
            <Button variant="ghost" onClick={() => router.push('/dashboards')}>Вернуться к списку</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 space-y-6">
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

        {/* Правая часть хедера: Статус, Контролы, Обновления */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Статус вычисления дашборда */}
          <div className="text-xs font-mono text-gray-400 dark:text-slate-500 mr-1">
            {isComputing ? (
              <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 animate-pulse">
                <Loader2 size={12} className="animate-spin" /> Вычисление...
              </span>
            ) : result ? (
              <span>Обновлено: {new Date(result.computedAt).toLocaleTimeString()}</span>
            ) : null}
          </div>

          {/* Бейдж статуса датасета + Кнопка обновления (только для PG) */}
          {boundDataset && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              {isPgSource ? (
                <>
                  <Database size={14} className={`shrink-0 ${pgStatus === 'offline' ? 'text-red-500' : 'text-indigo-600 dark:text-indigo-400'}`} />
                  <span className={`w-2 h-2 rounded-full ${
                    pgStatus === 'online' ? 'bg-emerald-500' :
                    pgStatus === 'offline' ? 'bg-red-500 animate-pulse' :
                    'bg-amber-400 animate-ping'
                  }`} />
                  <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                    {boundDataset.rows?.length ?? 0} строк
                  </span>
                </>
              ) : (
                <>
                  <FileSpreadsheet size={14} className="text-indigo-600 dark:text-indigo-400" />
                  <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wide">Excel</span>
                </>
              )}

              {isPgSource && (
                <button
                  onClick={handleRefreshDataset}
                  disabled={refreshingDataset || isSyncing}
                  className="ml-1 p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Обновить данные из PostgreSQL"
                >
                  <RefreshCw size={13} className={refreshingDataset ? 'animate-spin' : ''} />
                </button>
              )}
            </div>
          )}

          {/* Остальные контролы */}
          <AddKPIDialog dashboardId={dashboardId} />
          <button
            onClick={recalculate}
            disabled={isComputing}
            className="p-2 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-md transition disabled:opacity-50"
            title="Пересчитать показатели"
          >
            <RotateCw size={18} className={isComputing ? 'animate-spin' : ''} />
          </button>
          <Link
            href={`/dashboards/${dashboardId}/edit`}
            className="flex items-center gap-2 bg-slate-900 dark:bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-slate-800 dark:hover:bg-indigo-700 transition text-sm font-medium shadow-sm"
            title='Редактировать'
          >
            <Edit size={16} />
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
              <div className="p-1 bg-red-100 dark:bg-red-900/50 rounded-full"> <X size={16} /> </div>
              <div>
                <h3 className="font-semibold text-sm">Ошибка расчета</h3>
                <p className="text-sm mt-1 opacity-90">{error}</p>
              </div>
            </div>
          )}
          <DashboardMetricsTable
            dashboardId={dashboardId}
            groups={result?.groups || []}
            loading={isComputing}
            hiddenMetricIds={hiddenMetricIds}
            onToggleMetricVisibility={toggleMetricVisibility}
            getGroupHref={(groupId) => `/groups/${groupId}?filters=${encodeURIComponent(JSON.stringify(currentPath))}`}
            className="mt-6"
          />
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