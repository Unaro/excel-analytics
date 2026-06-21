'use client';

import { useMemo, useState, useCallback } from 'react';
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
import { TimeBreakdownSection } from '@/shared/ui/time-breakdown';
import type { DateGranularity } from '@/shared/lib/computation/lib/types';
import { useGroupMetricConfigStore } from '@/entities/group-metric-config';
import type { MetricChartStyle } from '@/shared/lib/types/chart';
import { useAggregateNodesStore } from '@/entities/aggregate-nodes';
import { nodePathKey } from '@/shared/lib/types/aggregate';

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
    isTwoDimensional,
    resolveLabel,
  } = useGroupBreakdown(groupId, path, setPath);

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

  // metricId группы → templateId: ячейки таблицы берут CF из шаблона.
  const metricTemplateIds = useMemo(
    () => Object.fromEntries((group?.metrics ?? []).map(m => [m.id, m.templateId])),
    [group]
  );

  // Одномерные потребители не должны видеть устаревшие 2-D строки:
  // при выключении разбивки по дате isTwoDimensional меняется мгновенно,
  // а result обновляется асинхронно — без фильтра label'ы дублируются
  // (один элемент × каждый интервал) и ломают key-семантику таблицы.
  const oneDimBreakdown = useMemo(
    () => breakdown?.filter(item => item.dateLabel === undefined),
    [breakdown]
  );

  const chartBreakdown = useMemo(() => {
    const base = oneDimBreakdown ?? [];
    // Сырые (уникальные) label — позиция категории на оси. Резолв словаря
    // НЕ применяем здесь: разные коды могут давать одно имя → дубль категорий
    // → recharts роняет ключи осей (tick-<угол>). Имя показывается через
    // tickFormatter/тултип в самих чартах.
    return sortConfig
      ? sortBreakdown(base, sortConfig.key, sortConfig.direction)
      : base;
  }, [oneDimBreakdown, sortConfig]);

  // Видимость элементов (категорий) на барах/радаре — переключается чекбоксами
  // в таблице (аналог 2-D). Скрытые исключаются только из чартов, таблица
  // показывает всё.
  const [chartHiddenLabels, setChartHiddenLabels] = useState<Set<string>>(new Set());
  const toggleChartLabel = useCallback((label: string) => {
    setChartHiddenLabels(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }, []);
  const visibleChartBreakdown = useMemo(
    () => chartBreakdown.filter(item => !chartHiddenLabels.has(item.label)),
    [chartBreakdown, chartHiddenLabels]
  );

  const summaryVirtualMetrics = summary?.virtualMetrics ?? [];

  // Стиль чарта (столбец/линия) per-metric: храним в group-metric-config по
  // sourceMetricId. Карта для KPI-карточек + сеттер, пишущий в стор.
  const updateChartStyle = useGroupMetricConfigStore(s => s.updateChartStyle);
  const chartStyleByMetricId = useMemo(() => {
    const map: Record<string, MetricChartStyle | undefined> = {};
    virtualMetrics.forEach(vm => {
      if (vm.sourceMetricId) map[vm.sourceMetricId] = vm.chartStyle;
    });
    return map;
  }, [virtualMetrics]);
  const handleChartStyleChange = useCallback(
    (metricId: string, style: MetricChartStyle) => updateChartStyle(groupId, metricId, style),
    [updateChartStyle, groupId]
  );

  // ── Введённые значения узлов агрегата (overlay «введённое vs вычисленное») ──
  // Узлы хранятся по datasetId; путь узла = значения ключей currentPath + метка
  // строки разбивки. Колонка метрики берётся из fieldBinding шаблона SUM.
  const datasetId = group?.datasetId;
  const aggregateNodes = useAggregateNodesStore(s =>
    datasetId ? s.nodesByDataset[datasetId] : undefined
  );
  const nodeMap = useMemo(() => {
    const map = new Map<string, Record<string, number | null>>();
    for (const n of aggregateNodes ?? []) map.set(nodePathKey(n.path), n.values);
    return map;
  }, [aggregateNodes]);
  // metricId → имя колонки метрики (для lookup введённого значения).
  // VirtualMetricValue.sourceMetricId = id метрики группы.
  const columnByMetricId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of group?.metrics ?? []) {
      const col = m.fieldBindings[0]?.columnName;
      if (col) map[m.id] = col;
    }
    return map;
  }, [group]);
  const pathValues = useMemo(() => path.map(f => f.value), [path]);
  // Введённое значение узла для строки разбивки: rawLabel → vmId → число|null.
  const enteredByLabel = useMemo(() => {
    if (nodeMap.size === 0) return undefined;
    const out = new Map<string, Record<string, number | null>>();
    for (const item of breakdown ?? []) {
      if (item.dateLabel !== undefined) continue;
      const values = nodeMap.get(nodePathKey([...pathValues, item.label]));
      if (!values) continue;
      const byVm: Record<string, number | null> = {};
      for (const vm of summaryVirtualMetrics) {
        const col = vm.sourceMetricId ? columnByMetricId[vm.sourceMetricId] : undefined;
        if (col && col in values) byVm[vm.virtualMetricId] = values[col];
      }
      if (Object.keys(byVm).length) out.set(item.label, byVm);
    }
    return out.size ? out : undefined;
  }, [nodeMap, breakdown, pathValues, summaryVirtualMetrics, columnByMetricId]);
  // Введённое значение текущего узла (строка «Итого»).
  const enteredSummary = useMemo(() => {
    if (nodeMap.size === 0 || pathValues.length === 0) return undefined;
    const values = nodeMap.get(nodePathKey(pathValues));
    if (!values) return undefined;
    const byVm: Record<string, number | null> = {};
    for (const vm of summaryVirtualMetrics) {
      const col = vm.sourceMetricId ? columnByMetricId[vm.sourceMetricId] : undefined;
      if (col && col in values) byVm[vm.virtualMetricId] = values[col];
    }
    return Object.keys(byVm).length ? byVm : undefined;
  }, [nodeMap, pathValues, summaryVirtualMetrics, columnByMetricId]);

  // Чарты: если вычисленное по листьям пусто (прочерк), берём введённое значение
  // узла. Иначе там, где данные есть только на уровне агрегата, столбцы = 0 и
  // аналитики нет. Реальное вычисленное значение (в т.ч. 0) не перетираем.
  const chartBreakdownWithEntered = useMemo(() => {
    if (!enteredByLabel) return visibleChartBreakdown;
    return visibleChartBreakdown.map(item => {
      const entered = enteredByLabel.get(item.label);
      if (!entered) return item;
      let changed = false;
      const vms = item.virtualMetrics.map(vm => {
        const e = entered[vm.virtualMetricId];
        if (vm.value == null && e != null) {
          changed = true;
          return { ...vm, value: e };
        }
        return vm;
      });
      return changed ? { ...item, virtualMetrics: vms } : item;
    });
  }, [visibleChartBreakdown, enteredByLabel]);

  if (!group) {
    return <GroupNotFound />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 p-6 space-y-6 transition-colors">
      <GroupPageHeader
        group={group}
        groupId={groupId}
        currentPath={path}
        onResetAll={resetAll}
        onResetToLevel={resetToLevel}
      />

      <GroupKpiGrid
        metrics={summaryVirtualMetrics}
        activeMetricIds={activeMetricIds}
        recordCount={summary?.recordCount ?? 0}
        onToggleMetric={handleToggleMetric}
        chartStyleByMetricId={chartStyleByMetricId}
        onChartStyleChange={handleChartStyleChange}
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
                <SelectOption value="">Без разбивки по дате</SelectOption>
                {(Object.keys(GRANULARITY_LABELS) as DateGranularity[]).map(g => (
                  <SelectOption key={g} value={g}>
                    + по дате: {GRANULARITY_LABELS[g]}
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

      {/* Двумерный режим: иерархия × время — pivot + линии */}
      {!isComputing && isTwoDimensional && breakdown && breakdown.length > 0 && (
        <TimeBreakdownSection
          items={breakdown}
          metricMetas={virtualMetrics}
          activeMetricIds={activeMetricIds}
          dimensionTitle={nextLevel?.displayName ?? 'Элемент'}
          dateTitle={
            dateColumn && dateGranularity
              ? `${dateColumn.displayName} · ${GRANULARITY_LABELS[dateGranularity]}`
              : 'Дата'
          }
          truncated={summary?.breakdownTruncated}
          onRowClick={drillDown}
          resolveLabel={resolveLabel}
        />
      )}

      {/* Одномерные режимы: иерархия ИЛИ время (на листе).
          Чарты — НАД таблицей. */}
      {!isComputing && !isTwoDimensional && visibleChartBreakdown.length > 0 && (
        <GroupChartsPanel
          breakdown={chartBreakdownWithEntered}
          virtualMetrics={summaryVirtualMetrics}
          metricConfigs={virtualMetrics}
          activeMetricIds={activeMetricIds}
          chartTypes={chartTypes}
          resolveLabel={resolveLabel}
        />
      )}

      {!isComputing && !isTwoDimensional && oneDimBreakdown && oneDimBreakdown.length > 0 && (
        <GroupBreakdownTable
          breakdown={oneDimBreakdown}
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
          metricTemplateIds={metricTemplateIds}
          resolveLabel={resolveLabel}
          chartHiddenLabels={chartHiddenLabels}
          onToggleChartLabel={chartTypes.length > 0 ? toggleChartLabel : undefined}
          enteredByLabel={enteredByLabel}
          enteredSummary={enteredSummary}
        />
      )}
    </div>
  );
}