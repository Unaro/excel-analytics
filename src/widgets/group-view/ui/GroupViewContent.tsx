'use client';

import { useMemo, useEffect } from 'react';
import { GroupBreakdownTable } from './GroupBreakdownTable';
import { GroupPageHeader } from './GroupPageHeader';
import { GroupKpiGrid } from './GroupKpiGrid';
import { ChartTypeSelector } from './ChartTypeSelector';
import { GroupChartsPanel } from './GroupChartsPanel';
import { GroupNotFound } from './GroupNotFound';
import { sortBreakdownItems as sortBreakdown } from '../lib/sort-breakdown';
import { useGroupViewState } from '../model/use-group-view-state';
import { useGroupPath } from '@/shared/lib/hooks/use-group-path';
import { useGroupBreakdown } from '../model/use-group-breakdown';
import { CalendarClock } from 'lucide-react';
import { Select, SelectOption } from '@/shared/ui/select';
import type { DateGranularity } from '@/shared/lib/computation/lib/types';

/** Подписи размерностей временно́й группировки. */
const GRANULARITY_LABELS: Record<DateGranularity, string> = {
  minute: 'минуты',
  hour: 'часы',
  day: 'дни',
  week: 'недели',
  month: 'месяцы',
  year: 'годы',
};

interface GroupViewContentProps {
  groupId: string;
}

export function GroupViewContent({ groupId }: GroupViewContentProps) {
  const { path, setPath } = useGroupPath();

  const {
    group,
    currentPath,
    nextLevel,
    summary,
    breakdown,
    virtualMetrics,
    baseVirtualMetrics,
    isComputing,
    error,
    drillDown,
    resetToLevel,
    resetAll,
    dateColumn,
    dateGranularity,
    setDateGranularity,
  } = useGroupBreakdown(groupId, path);

  const {
    activeMetricIds,
    chartTypes,
    sortConfig,
    setSortConfig,
    handleToggleMetric,
    handleChartTypesChange,
  } = useGroupViewState(virtualMetrics);

  const groupMetricIds = useMemo(() => {
    return group?.metrics.map(m => m.id) ?? [];
  }, [group]);

  useEffect(() => {
    const pathsEqual =
      path.length === currentPath.length &&
      path.every((p, i) =>
        p.levelId === currentPath[i]?.levelId &&
        p.value === currentPath[i]?.value
      );

    if (!pathsEqual) {
      setPath(currentPath);
    }
  }, [currentPath, path, setPath]);

  const chartBreakdown = useMemo(() => {
    if (!breakdown || !sortConfig) return breakdown ?? [];
    return sortBreakdown(breakdown, sortConfig.key, sortConfig.direction);
  }, [breakdown, sortConfig]);

  const summaryVirtualMetrics = summary?.virtualMetrics ?? [];

  if (!group) {
    return <GroupNotFound />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 p-6 space-y-6 transition-colors">
      <GroupPageHeader
        group={group}
        groupId={groupId}
        currentPath={currentPath}
        onResetAll={resetAll}
        onResetToLevel={resetToLevel}
      />

      <GroupKpiGrid
        metrics={summaryVirtualMetrics}
        activeMetricIds={activeMetricIds}
        recordCount={summary?.recordCount ?? 0}
        onToggleMetric={handleToggleMetric}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Визуализации
        </h2>
        <div className="flex items-center gap-3">
          {dateColumn && (
            <div className="flex items-center gap-2">
              <CalendarClock size={16} className="text-indigo-500 shrink-0" />
              <Select
                className="w-44 h-9 text-sm"
                value={dateGranularity ?? ''}
                onChange={e =>
                  setDateGranularity(
                    (e.target.value || null) as DateGranularity | null
                  )
                }
              >
                <SelectOption value="">По иерархии</SelectOption>
                {(Object.keys(GRANULARITY_LABELS) as DateGranularity[]).map(g => (
                  <SelectOption key={g} value={g}>
                    По дате: {GRANULARITY_LABELS[g]}
                  </SelectOption>
                ))}
              </Select>
            </div>
          )}
          <ChartTypeSelector
            selected={chartTypes}
            onChange={handleChartTypesChange}
          />
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl">
          <p className="font-semibold text-sm">Ошибка расчёта</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {isComputing && (
        <div className="p-8 text-center text-slate-400">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent" />
          <p className="mt-2 text-sm">Пересчёт показателей...</p>
        </div>
      )}

      {!isComputing && breakdown && breakdown.length > 0 && (
        <GroupBreakdownTable
          breakdown={breakdown}
          sortConfig={sortConfig}
          onSortChange={setSortConfig}
          summary={summary}
          virtualMetrics={summaryVirtualMetrics}
          metricMetas={baseVirtualMetrics}
          nextLevel={dateGranularity ? null : nextLevel}
          dimensionLabel={
            dateGranularity && dateColumn
              ? `${dateColumn.displayName} · ${GRANULARITY_LABELS[dateGranularity]}`
              : undefined
          }
          onDrillDown={drillDown}
          activeMetricIds={activeMetricIds}
          groupId={groupId}
          groupMetricIds={groupMetricIds}
        />
      )}

      {!isComputing && chartBreakdown.length > 0 && (
        <GroupChartsPanel
          breakdown={chartBreakdown}
          virtualMetrics={summaryVirtualMetrics}
          metricConfigs={virtualMetrics}
          activeMetricIds={activeMetricIds}
          chartTypes={chartTypes}
        />
      )}
    </div>
  );
}