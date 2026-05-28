'use client';
import { Suspense, use, useState, useMemo, useCallback, useEffect } from 'react';
import { useGroupBreakdown } from '@/lib/hooks/use-group-breakdown';
import { useGroupPath } from '@/lib/hooks/use-group-path';
import { useStoreHydration } from '@/lib/hooks/use-store-hydration';
import { LoadingScreen } from '@/shared/ui/loading-screen';
import { Button } from '@/shared/ui/button';
import Link from 'next/link';
import { GroupPageHeader } from './components/GroupPageHeader';
import { GroupKpiGrid } from './components/GroupKpiGrid';
import { GroupBreakdownTable } from './components/GroupBreakdownTable';
import { GroupChartsPanel } from './components/GroupChartsPanel';
import { ChartTypeSelector, ChartType } from './components/ChartTypeSelector';

function GroupProfileContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const hydrated = useStoreHydration();
  const { path, setPath } = useGroupPath();

  const {
    group, currentPath, nextLevel, summary, breakdown,
    virtualMetrics, isComputing, error,
    drillDown, resetToLevel, resetAll,
  } = useGroupBreakdown(id, path);

  const [activeMetricIds, setActiveMetricIds] = useState<string[]>([]);
  const [chartTypes, setChartTypes] = useState<ChartType[]>(['bar', 'radar']);

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

  // Авто-выбор первой метрики при загрузке группы
  useEffect(() => {
    if (virtualMetrics.length > 0 && activeMetricIds.length === 0) {
      setActiveMetricIds([virtualMetrics[0].id]);
    }
  }, [virtualMetrics]);

  const handleToggleMetric = useCallback((metricId: string) => {
    setActiveMetricIds(prev => {
      const isAlready = prev.includes(metricId);
      if (isAlready) {
        // Не даём отключить последнюю метрику
        if (prev.length === 1) return prev;
        return prev.filter(id => id !== metricId);
      }
      return [...prev, metricId];
    });
  }, []);

  const handleChartTypesChange = useCallback((types: ChartType[]) => {
    setChartTypes(types);
  }, []);

  const summaryVirtualMetrics = summary?.virtualMetrics ?? [];

  if (!hydrated) return <LoadingScreen message="Загрузка системы..." />;

  if (!group) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-950 gap-4">
        <div className="text-xl font-bold text-slate-900 dark:text-white">Группа не найдена</div>
        <Button variant="ghost" asChild>
          <Link href="/groups">Вернуться к списку</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 p-6 space-y-6 transition-colors">
      {/* Хедер + Breadcrumbs */}
      <GroupPageHeader
        group={group}
        groupId={id}
        currentPath={currentPath}
        onResetAll={resetAll}
        onResetToLevel={resetToLevel}
      />

      {/* KPI карточки с мультивыбором */}
      <GroupKpiGrid
        metrics={summaryVirtualMetrics}
        activeMetricIds={activeMetricIds}
        recordCount={summary?.recordCount ?? 0}
        onToggleMetric={handleToggleMetric}
      />

      {/* Селектор визуализаций */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Визуализации</h2>
        <ChartTypeSelector selected={chartTypes} onChange={handleChartTypesChange} />
      </div>

      {/* Индикатор ошибки */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl">
          <p className="font-semibold text-sm">Ошибка расчёта</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Состояние загрузки */}
      {isComputing && (
        <div className="p-8 text-center text-slate-400">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent" />
          <p className="mt-2 text-sm">Пересчёт показателей...</p>
        </div>
      )}

      {/* Таблица с разбивкой */}
      {!isComputing && breakdown && breakdown.length > 0 && (
        <GroupBreakdownTable
          breakdown={breakdown}
          summary={summary}
          virtualMetrics={summaryVirtualMetrics}
          nextLevel={nextLevel}
          onDrillDown={drillDown}
          activeMetricIds={activeMetricIds}
        />
      )}

      {/* Панель графиков */}
      {!isComputing && breakdown && breakdown.length > 0 && (
        <GroupChartsPanel
          breakdown={breakdown}
          virtualMetrics={summaryVirtualMetrics}
          activeMetricIds={activeMetricIds}
          chartTypes={chartTypes}
        />
      )}
    </div>
  );
}

export default function GroupProfilePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingScreen message="Загрузка профиля группы..." />}>
      <GroupProfileContent params={params} />
    </Suspense>
  );
}