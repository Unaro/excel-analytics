'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Layers, Filter, Loader2 } from 'lucide-react';
import { MetricCell } from '@/entities/metric/ui/metric-cell';
import { MetricConfigPopover } from '@/features/configure-table-metric';
import { useDashboardStore } from '@/entities/dashboard';
import { cn } from '@/shared/lib/utils';
import { GroupComputationResult } from '@/entities/metric';
import { VirtualMetric } from '@/shared/lib/validators';

export interface DashboardMetricsTableProps {
  dashboardId: string;
  groups: GroupComputationResult[];
  loading: boolean;
  hiddenMetricIds: string[];
  onToggleMetricVisibility: (id: string) => void;
  getGroupHref?: (groupId: string) => string;
  className?: string;
}

const EMPTY_METRICS: VirtualMetric[] = [];

export function DashboardMetricsTable({
  dashboardId,
  groups,
  loading,
  hiddenMetricIds,
  onToggleMetricVisibility,
  getGroupHref = (id) => `/groups/${id}`,
  className
}: DashboardMetricsTableProps) {
  const metrics = useDashboardStore(useMemo(() => (state) => {
    const dashboard = state.dashboards.find(d => d.id === dashboardId);
    return dashboard?.virtualMetrics || EMPTY_METRICS;
  }, [dashboardId]));

  const visibleMetrics = useMemo(
    () => metrics.filter((m) => !hiddenMetricIds.includes(m.id)),
    [metrics, hiddenMetricIds]
  );

  if (!loading && groups.length === 0) {
    return (
      <div className={cn("bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-8 text-center", className)}>
        <div className="flex flex-col items-center gap-2 text-slate-400">
          <Filter size={32} className="opacity-20" />
          <span className="text-sm">Нет данных для отображения</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden relative min-h-[300px]", className)}>
      {loading && (
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

              {visibleMetrics.map((metric) => (
                <th key={metric.id} scope="col" className="px-6 py-4 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider min-w-[150px] group/th relative">
                  <div className="flex justify-end gap-2 items-center">
                    <div className="mt-0.5">
                      <MetricConfigPopover dashboardId={dashboardId} metricId={metric.id} />
                    </div>
                    <div className="flex flex-col items-end">
                      <span>{metric.name}</span>
                      {metric.unit && (
                        <span className="text-[10px] text-slate-400 lowercase bg-slate-100 dark:bg-slate-800 px-1.5 rounded mt-0.5">{metric.unit}</span>
                      )}
                    </div>
                  </div>
                  {metric.colorConfig?.rules && metric.colorConfig.rules.length > 0 && (
                    <div className="absolute bottom-2 right-6 w-1 h-1 rounded-full bg-indigo-500" />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-100 dark:divide-slate-800/50">
            {groups.map((group) => (
              <tr key={group.groupId} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 group">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-slate-100 sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-indigo-50/30 dark:group-hover:bg-slate-900/50 border-r border-gray-100 dark:border-slate-800 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.05)]">
                  <Link
                    href={getGroupHref(group.groupId)}
                    className="hover:text-indigo-600 dark:hover:text-indigo-400 underline decoration-dashed underline-offset-4 decoration-slate-300"
                  >
                    {group.groupName}
                  </Link>
                </td>

                {visibleMetrics.map((metricConfig) => {
                  const metricVal = group.virtualMetrics.find((vm) => vm.virtualMetricId === metricConfig.id);
                  if (!metricConfig || !metricVal) return <td key={metricConfig.id} />;

                  return (
                    <td key={metricVal.virtualMetricId} className="px-6 py-4 whitespace-nowrap text-sm text-right border-l border-transparent hover:border-slate-100 dark:hover:border-slate-800">
                      <MetricCell value={metricVal.value} formattedValue={metricVal.formattedValue} metric={metricConfig} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}