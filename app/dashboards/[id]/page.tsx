'use client';

import { use } from 'react';
import Link from 'next/link';
import { useDashboardCalculation } from '@/lib/hooks/use-dashboard-calculation';
import { useHierarchyTree } from '@/lib/hooks/use-hierarchy-tree';
import { ChartsSection } from '@/components/dashboard/analytics/charts-section';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { useStoreHydration } from '@/lib/hooks/use-store-hydration';
import { HierarchyTree } from '@/components/dashboard/filters/hierarchy-tree';
import { 
  ArrowLeft, 
  Edit, 
  RotateCw, 
  Filter, 
  X,
  Layers,
  Loader2
} from 'lucide-react';
// import { WidgetRenderer } from '@/components/dashboard/widgets/widget-render';

export default function DashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const dashboardId = id;
  
  const hydrated = useStoreHydration();
  const dashboard = useDashboardStore(s => s.getDashboard(dashboardId));
  // Мы берем currentPath из хука иерархии для отображения крошек или просто передаем в Tree
  const { currentPath } = useHierarchyTree(dashboardId);
  const { result, isComputing, error, recalculate } = useDashboardCalculation(dashboardId);

  // Лоадер загрузки хранилища
  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3 text-gray-500 dark:text-slate-400">
          <Loader2 className="animate-spin" size={32} />
          <span>Загрузка системы...</span>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-950 gap-4">
        <div className="text-xl font-semibold text-gray-900 dark:text-white">Дашборд не найден</div>
        <Link href="/dashboards" className="text-indigo-600 dark:text-indigo-400 hover:underline">
          Вернуться к списку
        </Link>
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

          <button 
            onClick={recalculate} 
            disabled={isComputing}
            className="p-2 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-md transition disabled:opacity-50"
            title="Обновить данные"
          >
            <RotateCw size={18} className={isComputing ? 'animate-spin' : ''} />
          </button>
          
          <Link
            href={`/dashboard/${dashboardId}/edit`}
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
          
          {/* Статистика (опционально) */}
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
          
          {/* Блок Графиков (показываем только если есть результат) */}
          {result && (
             <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
               <ChartsSection result={result} />
             </div>
          )}

          {/* Ошибки */}
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

          {/* Таблица */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden relative min-h-[300px]">
            
            {/* Лоадер поверх таблицы */}
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
                    
                    {result?.virtualMetrics.map((vm) => (
                      <th key={vm.id} scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider min-w-[180px]">
                          <div className="flex flex-col items-end">
                            <span>{vm.name}</span>
                            {vm.unit && <span className="text-[10px] text-slate-400 lowercase bg-slate-100 dark:bg-slate-800 px-1.5 rounded mt-0.5">{vm.unit}</span>}
                          </div>
                      </th>
                    ))}
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
                      
                      {group.virtualMetrics.map((metricVal) => (
                        <td key={metricVal.virtualMetricId} className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          {metricVal.value === null ? (
                            <span className="text-slate-300 dark:text-slate-700 text-xl leading-none select-none">−</span>
                          ) : (
                            <span className="font-mono font-medium text-slate-700 dark:text-slate-300 tracking-tight">
                              {metricVal.formattedValue}
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          
      {/* // Секция виджетов (показываем, если они есть)
      {dashboard.widgets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {dashboard.widgets.map(widget => (
            <WidgetRenderer
              key={widget.id} 
              widget={widget} 
              result={result} 
              isComputing={isComputing} 
            />
          ))}
        </div>)} */}

        </div>
      </div>
    </div>
  );
}