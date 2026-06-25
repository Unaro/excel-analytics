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
import { useAggregateNodesStore, mergeEnteredVms, enteredVmValues, enteredCalcVmValues, type EnteredCalcSpec } from '@/entities/aggregate-nodes';
import { extractVariables } from '@/shared/lib/utils/formula';
import { nodePathKey } from '@/shared/lib/types/aggregate';
import { useMetricTemplateStore } from '@/entities/metric';
import { normalizeVmRows, type NormalizeConfig } from '@/shared/lib/utils/normalize';
import { buildNormalizedChartConfigs } from '@/shared/lib/utils/chart-format';
import { metricPalette, categoryPalette } from '@/shared/lib/utils/chart-palette';
import { PalettePicker } from '@/shared/ui/palette-picker';
import { useIndicatorGroupStore } from '@/entities/indicator-group';

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

  // Палитра группы (paletteId) красит серии чартов: 1-D — метрики, 2-D —
  // категории. Дефолт сохраняет текущие цвета (см. metricPalette/categoryPalette).
  const updateGroup = useIndicatorGroupStore(s => s.updateGroup);
  const palette1D = useMemo(() => metricPalette(group?.paletteId), [group?.paletteId]);
  const paletteCat = useMemo(() => categoryPalette(group?.paletteId), [group?.paletteId]);

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

  const summaryVirtualMetrics = useMemo(
    () => summary?.virtualMetrics ?? [],
    [summary]
  );

  // Нормализация столбцов (% от итога/макс/…): конфиг берётся с шаблона метрики.
  // virtualMetricId → {база, точность}. Применяется только к строкам разбивки
  // (дети уровня); строка «Итого» остаётся абсолютной (она же — ориентир).
  const templates = useMetricTemplateStore(s => s.templates);
  const normalizeByVmId = useMemo(() => {
    const byTemplate = new Map<string, NormalizeConfig>();
    for (const t of templates)
      if (t.normalizeBy) byTemplate.set(t.id, { base: t.normalizeBy, decimalPlaces: t.decimalPlaces });
    const map = new Map<string, NormalizeConfig>();
    if (byTemplate.size === 0) return map;
    for (const vm of summaryVirtualMetrics) {
      const templateId = metricTemplateIds[vm.sourceMetricId];
      const cfg = templateId ? byTemplate.get(templateId) : undefined;
      if (cfg) map.set(vm.virtualMetricId, cfg);
    }
    return map;
  }, [templates, summaryVirtualMetrics, metricTemplateIds]);

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

  // ── Введённые значения узлов файла-агрегата ──────────────────────────────
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
  // Расчётные (формула над операндами) исключаем — их считает enteredCalc.
  const isCalcMetric = (m: { fieldBindings: unknown[]; metricBindings: unknown[] }) =>
    m.metricBindings.length > 0 || m.fieldBindings.length > 1;
  const columnByMetricId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of group?.metrics ?? []) {
      if (isCalcMetric(m)) continue;
      const col = m.fieldBindings[0]?.columnName;
      if (col) map[m.id] = col;
    }
    return map;
  }, [group]);
  // Реестр расчётных: метрика → формула + привязка операндов к колонкам.
  const calcSpecByMetricId = useMemo(() => {
    const map: Record<string, EnteredCalcSpec> = {};
    for (const m of group?.metrics ?? []) {
      if (!isCalcMetric(m)) continue;
      const tpl = templates.find(t => t.id === m.templateId);
      if (!tpl?.formula) continue;
      const operandColumns: Record<string, string> = {};
      for (const fb of m.fieldBindings) operandColumns[fb.fieldAlias] = fb.columnName;
      for (const mb of m.metricBindings) {
        const col = columnByMetricId[mb.metricId];
        if (col) operandColumns[mb.metricAlias] = col;
      }
      const vars = extractVariables(tpl.formula);
      if (vars.length > 0 && vars.every(v => v in operandColumns)) {
        map[m.id] = { formula: tpl.formula, operandColumns };
      }
    }
    return map;
  }, [group, templates, columnByMetricId]);
  const pathValues = useMemo(() => path.map(f => f.value), [path]);
  // Введённое значение узла для строки разбивки: rawLabel → vmId → число|null.
  const enteredByLabel = useMemo(() => {
    if (nodeMap.size === 0) return undefined;
    const out = new Map<string, Record<string, number | null>>();
    for (const item of breakdown ?? []) {
      if (item.dateLabel !== undefined) continue;
      const values = nodeMap.get(nodePathKey([...pathValues, item.label]));
      if (!values) continue;
      const byVm = {
        ...enteredVmValues(values, summaryVirtualMetrics, columnByMetricId),
        ...enteredCalcVmValues(values, summaryVirtualMetrics, calcSpecByMetricId),
      };
      if (Object.keys(byVm).length) out.set(item.label, byVm);
    }
    return out.size ? out : undefined;
  }, [nodeMap, breakdown, pathValues, summaryVirtualMetrics, columnByMetricId, calcSpecByMetricId]);
  // Введённое значение текущего узла (строка «Итого»).
  const enteredSummary = useMemo(() => {
    if (nodeMap.size === 0 || pathValues.length === 0) return undefined;
    const values = nodeMap.get(nodePathKey(pathValues));
    if (!values) return undefined;
    const byVm = {
      ...enteredVmValues(values, summaryVirtualMetrics, columnByMetricId),
      ...enteredCalcVmValues(values, summaryVirtualMetrics, calcSpecByMetricId),
    };
    return Object.keys(byVm).length ? byVm : undefined;
  }, [nodeMap, pathValues, summaryVirtualMetrics, columnByMetricId, calcSpecByMetricId]);

  // Переключатель: считать введённые значения узлов как эффективные (тогда они
  // форматируются/сортируются/окрашиваются наравне с вычисленными) либо
  // показывать их отдельной подписью «введено: X» поверх вычисленного.
  const hasEnteredData = nodeMap.size > 0;
  const [useEnteredValues, setUseEnteredValues] = useState(true);
  const useEntered = hasEnteredData && useEnteredValues;

  // Эффективные значения: вычисленное ?? введённое (когда тумблер включён).
  const effectiveSummaryMetrics = useMemo(
    () => (useEntered ? mergeEnteredVms(summaryVirtualMetrics, enteredSummary) : summaryVirtualMetrics),
    [useEntered, summaryVirtualMetrics, enteredSummary]
  );
  const effectiveBreakdown = useMemo(() => {
    if (!useEntered || !enteredByLabel || !oneDimBreakdown) return oneDimBreakdown;
    return oneDimBreakdown.map(item => {
      const entered = enteredByLabel.get(item.label);
      if (!entered) return item;
      const vms = mergeEnteredVms(item.virtualMetrics, entered);
      return vms === item.virtualMetrics ? item : { ...item, virtualMetrics: vms };
    });
  }, [useEntered, oneDimBreakdown, enteredByLabel]);

  // Нормализация (% от итога/макс/…) — пост-пасс по столбцу детей текущего
  // уровня, ПОСЛЕ overlay (введённые узлы входят в знаменатель как есть).
  // Итого не трогаем (effectiveSummaryMetrics остаётся абсолютным).
  const displayBreakdown = useMemo(
    () => (effectiveBreakdown ? normalizeVmRows(effectiveBreakdown, normalizeByVmId) : effectiveBreakdown),
    [effectiveBreakdown, normalizeByVmId]
  );

  // Для чартов нормализованные метрики показываем процентом: чарт строит только
  // доли-детей (без «Итого»), поэтому колоночный percent тут корректен (и ось,
  // и тултип идут в масштабе %). В таблице формат остаётся абсолютным (Итого).
  const chartMetricConfigs = useMemo(
    () => buildNormalizedChartConfigs(virtualMetrics, normalizeByVmId),
    [virtualMetrics, normalizeByVmId]
  );

  // Сортировка чартов идёт по эффективным значениям (введённые тоже участвуют).
  const chartBreakdown = useMemo(() => {
    const base = displayBreakdown ?? [];
    // Сырые (уникальные) label — позиция категории на оси. Резолв словаря НЕ
    // применяем здесь: разные коды могут давать одно имя → дубль категорий →
    // recharts роняет ключи осей. Имя — через tickFormatter/тултип в чартах.
    return sortConfig
      ? sortBreakdown(base, sortConfig.key, sortConfig.direction)
      : base;
  }, [displayBreakdown, sortConfig]);
  const visibleChartBreakdown = useMemo(
    () => chartBreakdown.filter(item => !chartHiddenLabels.has(item.label)),
    [chartBreakdown, chartHiddenLabels]
  );

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
        metrics={effectiveSummaryMetrics}
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
          {hasEnteredData && (
            <label
              className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer select-none"
              title="Показывать введённые значения узлов файла-агрегата вместо суммы по листьям там, где они заданы (форматирование, сортировка и окрашивание применяются к ним). Выключите, чтобы видеть вычисленное + «введено: X / Δ» отдельной подписью."
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
          <PalettePicker
            value={group.paletteId}
            onChange={id => updateGroup(groupId, { paletteId: id })}
          />
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
          normalizeByVmId={normalizeByVmId}
          palette={paletteCat}
        />
      )}

      {/* Одномерные режимы: иерархия ИЛИ время (на листе).
          Чарты — НАД таблицей. */}
      {!isComputing && !isTwoDimensional && visibleChartBreakdown.length > 0 && (
        <GroupChartsPanel
          breakdown={visibleChartBreakdown}
          virtualMetrics={effectiveSummaryMetrics}
          metricConfigs={chartMetricConfigs}
          activeMetricIds={activeMetricIds}
          chartTypes={chartTypes}
          resolveLabel={resolveLabel}
          palette={palette1D}
        />
      )}

      {!isComputing && !isTwoDimensional && oneDimBreakdown && oneDimBreakdown.length > 0 && (
        <GroupBreakdownTable
          breakdown={displayBreakdown ?? oneDimBreakdown}
          sortConfig={sortConfig}
          onSortChange={setSortConfig}
          summary={summary}
          virtualMetrics={effectiveSummaryMetrics}
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
          enteredByLabel={useEntered ? undefined : enteredByLabel}
          enteredSummary={useEntered ? undefined : enteredSummary}
        />
      )}
    </div>
  );
}