'use client';
import { useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useGroupBreakdown } from '@/features/group-breakdown';
import { useGroupPath } from '@/features/group-path';
import { useGroupViewState } from '@/features/group-view-state';
import { ClientOnly } from '@/shared/lib/hydration';
import { LoadingScreen } from '@/shared/ui/loading-screen';
import { Button } from '@/shared/ui/button';
import { GroupBreakdownTable, sortBreakdownItems } from './GroupBreakdownTable';
import { GroupPageHeader } from './GroupPageHeader';
import { GroupKpiGrid } from './GroupKpiGrid';
import { ChartTypeSelector } from './ChartTypeSelector';
import { GroupChartsPanel } from './GroupChartsPanel';


interface GroupViewWidgetProps {
  groupId: string;
}

export function GroupViewWidget({ groupId }: GroupViewWidgetProps) {
  return (
    <ClientOnly fallback={<LoadingScreen message="Загрузка профиля группы..." />}>
      <GroupViewContent groupId={groupId} />
    </ClientOnly>
  );
}

function GroupViewContent({ groupId }: GroupViewWidgetProps) {
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

  // Синхронизация path с URL
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
    return sortBreakdownItems(breakdown, sortConfig.key, sortConfig.direction);
  }, [breakdown, sortConfig]);

  const summaryVirtualMetrics = summary?.virtualMetrics ?? [];

  if (!group) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-950 gap-4">
        <div className="text-xl font-bold text-slate-900 dark:text-white">
          Группа не найдена
        </div>
        <Button variant="ghost" asChild>
          <Link href="/groups">Вернуться к списку</Link>
        </Button>
      </div>
    );
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

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Визуализации
        </h2>
        <ChartTypeSelector
          selected={chartTypes}
          onChange={handleChartTypesChange}
        />
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
          nextLevel={nextLevel}
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