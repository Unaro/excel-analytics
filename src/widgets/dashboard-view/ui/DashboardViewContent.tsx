'use client';

import { use, useMemo, useState } from 'react';
import { useDashboardStore } from '@/entities/dashboard';
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
import { flattenDashboardResult } from '@/entities/metric';
import { normalizeVmRows, type NormalizeConfig } from '@/shared/lib/utils/normalize';
import { Loader2, CalendarClock } from 'lucide-react';
import { Select, SelectOption } from '@/shared/ui/select';
import { TimeBreakdownSection } from '@/shared/ui/time-breakdown';
import type { DateGranularity } from '@/shared/lib/computation/lib/types';
import type { BreakdownItem, DashboardComputationResult } from '@/shared/lib/types/computation';
import { HierarchyFilterValue } from '@/shared/lib/validators';
import { useIndicatorGroupStore } from '@/entities/indicator-group';
import { useAggregateNodesStore, mergeEnteredVms, enteredVmValues } from '@/entities/aggregate-nodes';
import { nodePathKey } from '@/shared/lib/types/aggregate';


const EMPTY_FILTERS: HierarchyFilterValue[] = [];

/** Подписи размерностей временно́й группировки. */
const GRANULARITY_LABELS: Record<DateGranularity, string> = {
  minute: 'минуты',
  hour: 'часы',
  day: 'дни',
  week: 'недели',
  month: 'месяцы',
  year: 'годы',
};

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

  // Временна́я группировка: серии — группы дашборда, X — интервалы даты
  const [dateGranularity, setDateGranularity] = useState<DateGranularity | null>(null);

  // Вычисление метрик дашборда
  const { result, isComputing, error, recalculate, dateColumn, effectiveVirtualMetrics, kpiResults } =
    useDashboardComputation(dashboardId, { dateGranularity });

  // Данные дашборда
  const dashboard = useDashboardStore(
    useShallow(s => s.dashboards.find(d => d.id === dashboardId))
  );

  // useShallow сравнивает РЕЗУЛЬТАТ селектора по shallow-равенству —
  // мемоизировать сам селектор через useCallback не нужно (и вредно:
  // лишняя обёртка скрывала суть сравнения).
  const hierarchyFilters = useDashboardStore(
    useShallow(
      s => s.dashboards.find(d => d.id === dashboardId)?.hierarchyFilters ?? EMPTY_FILTERS
    )
  );

  // ── Введённые значения узлов агрегата (как на странице группы) ───────────
  // Дашборд = «группа групп»: каждая строка-группа = узел на текущем пути
  // иерархических фильтров. Где у узла есть введённое значение — оно перекрывает
  // вычисленное (форматирование/сортировка/окрашивание работают на нём).
  const datasetId = dashboard?.datasetId;
  const aggregateNodes = useAggregateNodesStore(s =>
    datasetId ? s.nodesByDataset[datasetId] : undefined
  );
  const nodeMap = useMemo(() => {
    const map = new Map<string, Record<string, number | null>>();
    for (const n of aggregateNodes ?? []) map.set(nodePathKey(n.path), n.values);
    return map;
  }, [aggregateNodes]);
  const indicatorGroups = useIndicatorGroupStore(useShallow(s => s.groups));
  const columnByMetricId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const g of indicatorGroups) {
      for (const m of g.metrics) {
        const col = m.fieldBindings[0]?.columnName;
        if (col) map[m.id] = col;
      }
    }
    return map;
  }, [indicatorGroups]);
  const pathValues = useMemo(() => hierarchyFilters.map(f => f.value), [hierarchyFilters]);

  const hasEnteredData = nodeMap.size > 0;
  const [useEnteredValues, setUseEnteredValues] = useState(true);
  const useEntered = hasEnteredData && useEnteredValues;

  // Эффективный результат: сводки групп с подстановкой введённых значений узла
  // на текущем пути фильтров (overlay только на virtualMetrics-сводки).
  const effectiveResult = useMemo<DashboardComputationResult | null>(() => {
    if (!useEntered || !result) return result;
    const values = nodeMap.get(nodePathKey(pathValues));
    if (!values) return result;
    const groups = result.groups.map(group => {
      const entered = enteredVmValues(values, group.virtualMetrics, columnByMetricId);
      const vms = mergeEnteredVms(group.virtualMetrics, entered);
      return vms === group.virtualMetrics ? group : { ...group, virtualMetrics: vms };
    });
    return { ...result, groups };
  }, [useEntered, result, nodeMap, pathValues, columnByMetricId]);

  // UI-состояние чартов и таблицы — на эффективных колонках (формат из
  // шаблона), а не на хранимых (которые несут только templateId/colorConfig).
  const dashboardVirtualMetrics = effectiveVirtualMetrics;
  const viewState = useDashboardViewState(dashboardVirtualMetrics);

  // Нормализация (% от итога/макс/…): столбец дашборда = строки-группы. База
  // выводится из шаблона (normalizeBy на эффективной колонке). Пост-пасс ПОСЛЕ
  // overlay (введённые узлы входят в знаменатель). На breakdown/динамику и
  // record-count (DashboardStats) не влияет — только сводки групп в таблице/чартах.
  const normalizeByVmId = useMemo(() => {
    const map = new Map<string, NormalizeConfig>();
    for (const vm of dashboardVirtualMetrics)
      if (vm.normalizeBy) map.set(vm.id, { base: vm.normalizeBy, decimalPlaces: vm.decimalPlaces });
    return map;
  }, [dashboardVirtualMetrics]);
  const displayResult = useMemo<DashboardComputationResult | null>(() => {
    if (!effectiveResult || normalizeByVmId.size === 0) return effectiveResult;
    return { ...effectiveResult, groups: normalizeVmRows(effectiveResult.groups, normalizeByVmId) };
  }, [effectiveResult, normalizeByVmId]);

  // Для чартов нормализованные метрики показываем процентом (ось+тултип в
  // масштабе %); в таблице формат остаётся абсолютным.
  const chartMetricConfigs = useMemo(
    () =>
      normalizeByVmId.size === 0
        ? dashboardVirtualMetrics
        : dashboardVirtualMetrics.map(vm =>
            normalizeByVmId.has(vm.id) ? { ...vm, displayFormat: 'percent' as const } : vm
          ),
    [dashboardVirtualMetrics, normalizeByVmId]
  );

  // Плоские данные для ChartsSectionWidget
  const { breakdown, virtualMetrics } = useMemo(
    () => flattenDashboardResult(displayResult, dashboardVirtualMetrics),
    [displayResult, dashboardVirtualMetrics]
  );

  // Данные секции динамики: серия — группа дашборда, точка — интервал даты.
  // В режиме дат breakdown каждой группы одномерен (метки — интервалы),
  // конвертируем его в формат «категория × время» для TimeBreakdownSection.
  const isTimeMode = dateGranularity !== null && !!dateColumn;
  const timeItems = useMemo<BreakdownItem[]>(() => {
    if (!isTimeMode || !effectiveResult) return [];
    return effectiveResult.groups.flatMap(group =>
      (group.breakdown ?? []).map(item => ({
        label: group.groupName,
        dateLabel: item.label,
        recordCount: item.recordCount,
        virtualMetrics: item.virtualMetrics,
      }))
    );
  }, [isTimeMode, effectiveResult]);
  const timeTruncated = isTimeMode && !!effectiveResult?.groups.some(g => g.breakdownTruncated);

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
          <DashboardStats result={effectiveResult} />
        </div>

        <div className="lg:col-span-9 space-y-6">
          <ErrorBoundary label="KPI Grid" onReset={recalculate}>
            <KPIGrid
              dashboardId={dashboardId}
              results={kpiResults}
              isEditMode={true}
            />
          </ErrorBoundary>

          {/* Переключатели: введённые значения узлов + временна́я группировка */}
          {(hasEnteredData || dateColumn) && (
            <div className="flex items-center justify-end gap-4">
              {hasEnteredData && (
                <label
                  className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer select-none"
                  title="Показывать введённые значения узлов файла-агрегата вместо вычисленных там, где они заданы (на текущем уровне иерархических фильтров)."
                >
                  <input
                    type="checkbox"
                    checked={useEnteredValues}
                    onChange={e => setUseEnteredValues(e.target.checked)}
                    className="accent-indigo-600 w-4 h-4"
                  />
                  Считать введённые значения
                  {useEntered && (
                    <span className="text-[11px] text-amber-600 dark:text-amber-400 inline-flex items-center gap-1">
                      (<span className="text-amber-500">●</span> — из узла файла)
                    </span>
                  )}
                </label>
              )}
              {dateColumn && (
              <div className="flex items-center gap-2">
              <CalendarClock size={16} className="text-indigo-500 shrink-0" />
              <Select
                className="w-52 h-9 text-sm"
                value={dateGranularity ?? ''}
                onChange={e =>
                  setDateGranularity(
                    (e.target.value || null) as DateGranularity | null
                  )
                }
              >
                <SelectOption value="">Без разбивки по дате</SelectOption>
                {(Object.keys(GRANULARITY_LABELS) as DateGranularity[]).map(g => (
                  <SelectOption key={g} value={g}>
                    Динамика: {GRANULARITY_LABELS[g]}
                  </SelectOption>
                ))}
              </Select>
              </div>
              )}
            </div>
          )}

          {/* Режим динамики: группы × время */}
          {isTimeMode && !isComputing && timeItems.length > 0 && (
            <ErrorBoundary label="Динамика по времени" onReset={recalculate}>
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                <TimeBreakdownSection
                  items={timeItems}
                  metricMetas={dashboardVirtualMetrics}
                  activeMetricIds={viewState.activeMetricIds}
                  dimensionTitle="Группа"
                  dateTitle={`${dateColumn?.displayName ?? 'Дата'} · ${
                    dateGranularity ? GRANULARITY_LABELS[dateGranularity] : ''
                  }`}
                  truncated={timeTruncated}
                  normalizeByVmId={normalizeByVmId}
                />
              </div>
            </ErrorBoundary>
          )}

          {/* Обычный режим: чарты по сводкам групп */}
          {!isTimeMode && displayResult && breakdown.length > 0 && (
            <ErrorBoundary label="Графики" onReset={recalculate}>
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                <ChartsSectionWidget
                  breakdown={breakdown}
                  virtualMetrics={virtualMetrics}
                  metricConfigs={chartMetricConfigs}
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
              groups={displayResult?.groups || []}
              metrics={dashboardVirtualMetrics}
              loading={isComputing}
              hiddenMetricIds={viewState.hiddenMetricIds}
              onToggleMetricVisibility={viewState.toggleMetricVisibility}
              getGroupHref={groupId =>
                `/groups/${groupId}?filters=${encodeURIComponent(JSON.stringify(hierarchyFilters))}`
              }
              className="mt-6"
            />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}