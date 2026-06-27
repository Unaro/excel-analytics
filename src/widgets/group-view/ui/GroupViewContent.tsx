'use client';

import { useMemo, useState, useCallback } from 'react';
import { GroupBreakdownTable } from './GroupBreakdownTable';
import { GroupPageHeader } from './GroupPageHeader';
import { GroupKpiGrid } from './GroupKpiGrid';
import { ChartTypeSelector } from './ChartTypeSelector';
import { GroupChartsPanel } from './GroupChartsPanel';
import { GroupNotFound } from './GroupNotFound';
import { sortBreakdownItems as sortBreakdown } from '../lib/sort-breakdown';
import { filterBreakdownByRules } from '../lib/filter-breakdown';
import { aggregateByLabel } from '../lib/aggregate-breakdown';
import type { MetricCalcSpec } from '@/shared/ui/time-breakdown/pivot';
import { DisplayFilterPanel } from './DisplayFilterPanel';
import { useGroupViewState } from '../model/use-group-view-state';
import { useGroupPath } from '@/shared/lib/hooks/use-group-path';
import { useGroupBreakdown } from '../model/use-group-breakdown';
import { SplitSquareHorizontal } from 'lucide-react';
import { Select, SelectOption } from '@/shared/ui/select';
import { TimeBreakdownSection } from '@/shared/ui/time-breakdown';
import type { DateGranularity } from '@/shared/lib/computation/lib/types';
import { useGroupMetricConfigStore } from '@/entities/group-metric-config';
import type { MetricChartStyle, ChartType } from '@/shared/lib/types/chart';
import { resolveChartView } from '@/shared/lib/types/chart';
import { useAggregateNodesStore, mergeEnteredVms, enteredVmValues, enteredCalcVmValues, rollupNodes, type EnteredCalcSpec } from '@/entities/aggregate-nodes';
import { extractVariables } from '@/shared/lib/utils/formula';
import { safeEvaluate } from '@/shared/lib/math/safe-math';
import { formatValue } from '@/shared/lib/computation/lib/utils';
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
    secondary,
    setSecondary,
    secondaryColumns,
    isTwoDimensional,
    resolveLabel,
  } = useGroupBreakdown(groupId, path, setPath);

  // Значение/заголовок второй оси разбивки (дата|колонка) для селектора и pivot.
  const secondaryValue = !secondary
    ? ''
    : secondary.kind === 'date'
      ? `date:${secondary.granularity}`
      : `col:${secondary.columnName}`;
  const secondaryTitle = !secondary
    ? 'Разбивка'
    : secondary.kind === 'date'
      ? `${dateColumn?.displayName ?? 'Дата'} · ${GRANULARITY_LABELS[secondary.granularity]}`
      : secondaryColumns.find(c => c.columnName === secondary.columnName)?.displayName ?? secondary.columnName;

  const {
    activeMetricIds,
    sortConfig,
    setSortConfig,
    handleToggleMetric,
  } = useGroupViewState(groupId, virtualMetrics);

  const groupMetricIds = useMemo(() => {
    return group?.metrics.map(m => m.id) ?? [];
  }, [group]);

  // Единый вид чартов группы (типы 1-D, вид 2-D, лимит серий, палитра) —
  // персистится на группе (chartView). resolveChartView подставляет дефолты и
  // fallback paletteId со старых групп. Все изменения пишем через updateGroup.
  const updateGroup = useIndicatorGroupStore(s => s.updateGroup);
  const view = useMemo(() => resolveChartView(group), [group]);
  const chartTypes = view.chartTypes;
  const patchChartView = useCallback(
    (patch: Partial<NonNullable<typeof group>['chartView']>) =>
      updateGroup(groupId, { chartView: { ...group?.chartView, ...patch } }),
    [groupId, group?.chartView, updateGroup]
  );
  const handleChartTypesChange = useCallback(
    (types: ChartType[]) => patchChartView({ chartTypes: types }),
    [patchChartView]
  );
  // Палитра группы красит серии чартов: 1-D — метрики, 2-D — категории.
  // Дефолт сохраняет текущие цвета (см. metricPalette/categoryPalette).
  const palette1D = useMemo(() => metricPalette(view.paletteId), [view.paletteId]);
  const paletteCat = useMemo(() => categoryPalette(view.paletteId), [view.paletteId]);

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
  // Агрегат-датасет: расчёты идут из узлов (overlay), листья пусты. Узлы
  // сплющены вдоль одного каскада ключевых колонок — ячейки «(категория ×
  // вторая ось)» в узлах не существует, поэтому разбивка по второй оси даёт
  // пустоту. Скрываем её селектор (см. также блокировку иерархии — она и есть
  // этот каскад, структурный индекс узлов).
  const isAggregateDataset = (aggregateNodes?.length ?? 0) > 0;
  // Rolled-up узлы (own + childrenSum); своё значение в приоритете, иначе сумма
  // детей. nodeMap = итог (value) для overlay; nodeRich несёт own/childrenSum
  // для показа расхождения «записано в файле vs сумма по детям».
  const nodeRich = useMemo(() => rollupNodes(aggregateNodes ?? []), [aggregateNodes]);
  const nodeMap = useMemo(() => {
    const out = new Map<string, Record<string, number | null>>();
    for (const [key, cells] of nodeRich) {
      const v: Record<string, number | null> = {};
      for (const [col, cell] of Object.entries(cells)) v[col] = cell.value;
      out.set(key, v);
    }
    return out;
  }, [nodeRich]);
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
  // Реестр расчётных для ИТОГОВ 2-D: vmId → формула + операнды-метрики (vmId).
  // Только когда операнды — другие метрики строки (значения есть в ячейках);
  // field-only calc сюда не попадает (операндов в разбивке нет) → обычная сумма.
  const calcSpecByVmId = useMemo(() => {
    const vmIdBySrc: Record<string, string> = {};
    for (const vm of virtualMetrics) if (vm.sourceMetricId) vmIdBySrc[vm.sourceMetricId] = vm.id;
    const map: Record<string, MetricCalcSpec> = {};
    for (const m of group?.metrics ?? []) {
      if (!isCalcMetric(m)) continue;
      const tpl = templates.find(t => t.id === m.templateId);
      const vmId = vmIdBySrc[m.id];
      if (!tpl?.formula || !vmId) continue;
      const operandVmByAlias: Record<string, string> = {};
      for (const mb of m.metricBindings) {
        const opVm = vmIdBySrc[mb.metricId];
        if (opVm) operandVmByAlias[mb.metricAlias] = opVm;
      }
      const vars = extractVariables(tpl.formula);
      if (vars.length > 0 && vars.every(v => v in operandVmByAlias)) {
        map[vmId] = { formula: tpl.formula, operandVmByAlias };
      }
    }
    return map;
  }, [group, templates, virtualMetrics]);

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
  // Введённое значение текущего узла (строка «Итого»/KPI). На верхнем уровне
  // (пустой путь) берётся синтетический корень rollup (сумма узлов верхнего
  // уровня) — чтобы сводка добирала总 по детям, а не показывала «—».
  const enteredSummary = useMemo(() => {
    if (nodeMap.size === 0) return undefined;
    const values = nodeMap.get(nodePathKey(pathValues));
    if (!values) return undefined;
    const byVm = {
      ...enteredVmValues(values, summaryVirtualMetrics, columnByMetricId),
      ...enteredCalcVmValues(values, summaryVirtualMetrics, calcSpecByMetricId),
    };
    return Object.keys(byVm).length ? byVm : undefined;
  }, [nodeMap, pathValues, summaryVirtualMetrics, columnByMetricId, calcSpecByMetricId]);

  // Расхождение «записано в файле (own) vs сумма по детям (childrenSum)».
  // Простая метрика — own/childrenSum по своей колонке. Расчётная — формула на
  // СОБСТВЕННЫХ значениях операндов vs на их суммах по детям (Σa/Σb), чтобы
  // показать, что подразумевают дети. Только где оба полностью считаются и реально
  // расходятся.
  const childrenDeltaForNode = useMemo(() => {
    const EPS = 1e-9;
    return (pathKey: string): Record<string, { own: number; childrenSum: number }> | undefined => {
      const cells = nodeRich.get(pathKey);
      if (!cells) return undefined;
      const rec: Record<string, { own: number; childrenSum: number }> = {};
      for (const vm of summaryVirtualMetrics) {
        const mid = vm.sourceMetricId;
        const col = mid ? columnByMetricId[mid] : undefined;
        if (col) {
          const cell = cells[col];
          if (cell && cell.own != null && cell.childrenSum != null && Math.abs(cell.own - cell.childrenSum) > EPS) {
            rec[vm.virtualMetricId] = { own: cell.own, childrenSum: cell.childrenSum };
          }
          continue;
        }
        // Расчётная: формула на own операндов vs на их childrenSum.
        const spec = mid ? calcSpecByMetricId[mid] : undefined;
        if (!spec) continue;
        const ownScope: Record<string, number | null> = {};
        const childScope: Record<string, number | null> = {};
        let okOwn = true;
        let okChild = true;
        for (const [alias, c] of Object.entries(spec.operandColumns)) {
          const cell = cells[c];
          if (!cell || cell.own == null) okOwn = false;
          if (!cell || cell.childrenSum == null) okChild = false;
          ownScope[alias] = cell?.own ?? 0;
          childScope[alias] = cell?.childrenSum ?? 0;
        }
        if (!okOwn || !okChild) continue;
        const own = safeEvaluate(spec.formula, ownScope);
        const childrenSum = safeEvaluate(spec.formula, childScope);
        if (own != null && childrenSum != null && Math.abs(own - childrenSum) > EPS) {
          rec[vm.virtualMetricId] = { own, childrenSum };
        }
      }
      return Object.keys(rec).length ? rec : undefined;
    };
  }, [nodeRich, summaryVirtualMetrics, columnByMetricId, calcSpecByMetricId]);
  const childrenDeltaByLabel = useMemo(() => {
    if (nodeRich.size === 0) return undefined;
    const out = new Map<string, Record<string, { own: number; childrenSum: number }>>();
    for (const item of breakdown ?? []) {
      if (item.dateLabel !== undefined) continue;
      const rec = childrenDeltaForNode(nodePathKey([...pathValues, item.label]));
      if (rec) out.set(item.label, rec);
    }
    return out.size ? out : undefined;
  }, [nodeRich, breakdown, pathValues, childrenDeltaForNode]);
  const childrenDeltaSummary = useMemo(
    () => childrenDeltaForNode(nodePathKey(pathValues)),
    [pathValues, childrenDeltaForNode]
  );

  // Переключатель: считать введённые значения узлов как эффективные (тогда они
  // форматируются/сортируются/окрашиваются наравне с вычисленными) либо
  // показывать их отдельной подписью «введено: X» поверх вычисленного.
  const hasEnteredData = nodeMap.size > 0;
  const [useEnteredValues, setUseEnteredValues] = useState(true);
  const useEntered = hasEnteredData && useEnteredValues;

  // Эффективные значения: вычисленное ?? введённое (когда тумблер включён).
  // overlay ставит formattedValue='—' (ждёт переформат из value). KPI-карточки
  // показывают formattedValue напрямую — переформатируем по конфигу метрики,
  // иначе на карточке «—» вместо итога по детям/введённого.
  const metaById = useMemo(
    () => new Map(virtualMetrics.map(m => [m.id, m])),
    [virtualMetrics]
  );
  const effectiveSummaryMetrics = useMemo(() => {
    if (!useEntered) return summaryVirtualMetrics;
    const merged = mergeEnteredVms(summaryVirtualMetrics, enteredSummary);
    return merged.map(vm => {
      if (vm.value == null || vm.formattedValue !== '—') return vm;
      const meta = metaById.get(vm.virtualMetricId);
      if (!meta) return vm;
      return { ...vm, formattedValue: formatValue(vm.value, meta.displayFormat, meta.decimalPlaces, meta.unit) };
    });
  }, [useEntered, summaryVirtualMetrics, enteredSummary, metaById]);
  const effectiveBreakdown = useMemo(() => {
    if (!useEntered || !enteredByLabel || !oneDimBreakdown) return oneDimBreakdown;
    return oneDimBreakdown.map(item => {
      const entered = enteredByLabel.get(item.label);
      if (!entered) return item;
      const vms = mergeEnteredVms(item.virtualMetrics, entered);
      return vms === item.virtualMetrics ? item : { ...item, virtualMetrics: vms };
    });
  }, [useEntered, oneDimBreakdown, enteredByLabel]);

  // Условия отображения (правила по метрике, хранятся на группе): фильтруем
  // элементы уровня ДО нормализации (проценты считаются по видимым). Сравнение
  // в масштабе отображения — формат метрики по id.
  const formatByMetricId = useMemo(() => {
    const m: Record<string, string | undefined> = {};
    for (const vm of virtualMetrics) m[vm.id] = vm.displayFormat;
    return m;
  }, [virtualMetrics]);
  const displayFilters = group?.displayFilters;
  // Правила действуют ТОЛЬКО на своём уровне (level = глубина пути): фильтр не
  // распространяется на дрилл вглубь, иначе скрытый родитель ломал бы навигацию.
  // Старые правила без level → 0 (корень).
  const activeDisplayFilters = useMemo(
    () => displayFilters?.filter(r => (r.level ?? 0) === path.length),
    [displayFilters, path.length]
  );
  const filterMetricOptions = useMemo(
    () => virtualMetrics.map(vm => ({ id: vm.id, name: vm.name })),
    [virtualMetrics]
  );
  const filteredBreakdown = useMemo(
    () => (effectiveBreakdown ? filterBreakdownByRules(effectiveBreakdown, activeDisplayFilters, formatByMetricId) : effectiveBreakdown),
    [effectiveBreakdown, activeDisplayFilters, formatByMetricId]
  );

  // Условия отображения в 2-D: правила применяются к КАТЕГОРИИ по её итогу
  // (calc-aware), затем breakdown фильтруется по разрешённым label.
  const cat2DTotal = useMemo(
    () => (isTwoDimensional && breakdown ? new Set(breakdown.map(i => i.label)).size : undefined),
    [isTwoDimensional, breakdown]
  );
  const allowed2DLabels = useMemo(() => {
    if (!isTwoDimensional || !breakdown || !activeDisplayFilters || activeDisplayFilters.length === 0) return null;
    const cats = aggregateByLabel(breakdown, calcSpecByVmId);
    const passed = filterBreakdownByRules(cats, activeDisplayFilters, formatByMetricId);
    return new Set(passed.map(c => c.label));
  }, [isTwoDimensional, breakdown, activeDisplayFilters, calcSpecByVmId, formatByMetricId]);
  const breakdown2D = useMemo(
    () => (allowed2DLabels && breakdown ? breakdown.filter(it => allowed2DLabels.has(it.label)) : breakdown),
    [breakdown, allowed2DLabels]
  );

  // Нормализация (% от итога/макс/…) — пост-пасс по столбцу детей текущего
  // уровня, ПОСЛЕ overlay (введённые узлы входят в знаменатель как есть).
  // Итого не трогаем (effectiveSummaryMetrics остаётся абсолютным).
  const displayBreakdown = useMemo(
    () => (filteredBreakdown ? normalizeVmRows(filteredBreakdown, normalizeByVmId) : filteredBreakdown),
    [filteredBreakdown, normalizeByVmId]
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
        groupId={groupId}
        metricTemplateIds={metricTemplateIds}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Визуализации
        </h2>
        <div className="flex items-center gap-3">
          <DisplayFilterPanel
            metrics={filterMetricOptions}
            rules={activeDisplayFilters ?? []}
            levelLabel={nextLevel?.displayName ?? 'корень'}
            onChange={rules => {
              // Правила привязаны к текущему уровню (level = глубина пути).
              // Сохраняем правила ДРУГИХ уровней, текущие — штампуем глубиной.
              const otherLevels = (displayFilters ?? []).filter(r => (r.level ?? 0) !== path.length);
              const stamped = rules.map(r => ({ ...r, level: path.length }));
              const next = [...otherLevels, ...stamped];
              updateGroup(groupId, { displayFilters: next.length ? next : undefined });
            }}
            shown={isTwoDimensional ? (allowed2DLabels ? allowed2DLabels.size : cat2DTotal) : filteredBreakdown?.length}
            total={isTwoDimensional ? cat2DTotal : effectiveBreakdown?.length}
          />
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
          {!isAggregateDataset && (dateColumn || secondaryColumns.length > 0) && (
            <div
              className="inline-flex items-center gap-1.5 h-9 pl-2 pr-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              title="Разбивка: первая ось (уровень иерархии) × вторая ось (дата или колонка)"
            >
              <SplitSquareHorizontal size={14} className="text-indigo-500 shrink-0" />
              {nextLevel && (
                <>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-200 max-w-[120px] truncate">
                    {nextLevel.displayName}
                  </span>
                  <span className="text-slate-400 text-sm">×</span>
                </>
              )}
              <Select
                className="h-7 w-44 text-xs px-1.5 py-0 border-0 bg-transparent focus:ring-0"
                value={secondaryValue}
                onChange={e => {
                  const v = e.target.value;
                  if (!v) setSecondary(null);
                  else if (v.startsWith('date:') && dateColumn)
                    setSecondary({ kind: 'date', columnName: dateColumn.columnName, granularity: v.slice(5) as DateGranularity });
                  else if (v.startsWith('col:'))
                    setSecondary({ kind: 'column', columnName: v.slice(4), topN: 12 });
                }}
              >
                <SelectOption value="">Без разбивки</SelectOption>
                {dateColumn && (Object.keys(GRANULARITY_LABELS) as DateGranularity[]).map(g => (
                  <SelectOption key={`date:${g}`} value={`date:${g}`}>
                    Дата · {GRANULARITY_LABELS[g]}
                  </SelectOption>
                ))}
                {secondaryColumns.map(c => (
                  <SelectOption key={`col:${c.columnName}`} value={`col:${c.columnName}`}>
                    {c.displayName}
                  </SelectOption>
                ))}
              </Select>
              {secondary?.kind === 'column' && (
                <input
                  type="number"
                  min={1}
                  value={secondary.topN ?? 12}
                  onChange={e =>
                    setSecondary({ kind: 'column', columnName: secondary.columnName, topN: Math.max(1, Number(e.target.value) || 12) })
                  }
                  title="Топ-N значений второй оси, остальное → «Прочее»"
                  className="w-14 h-7 px-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 outline-none focus:ring-1 focus:ring-indigo-500"
                />
              )}
            </div>
          )}
          <PalettePicker
            value={view.paletteId}
            onChange={id => patchChartView({ paletteId: id })}
          />
          {/* Типы 1-D-чартов (bar/radar/treemap) в 2-D не применяются — скрываем. */}
          {!isTwoDimensional && (
            <ChartTypeSelector
              selected={chartTypes}
              onChange={handleChartTypesChange}
            />
          )}
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

      {/* Двумерный режим: иерархия × вторая ось — pivot + чарты */}
      {!isComputing && isTwoDimensional && breakdown2D && breakdown2D.length > 0 && (
        <TimeBreakdownSection
          items={breakdown2D}
          metricMetas={virtualMetrics}
          activeMetricIds={activeMetricIds}
          dimensionTitle={nextLevel?.displayName ?? 'Элемент'}
          dateTitle={secondaryTitle}
          truncated={summary?.breakdownTruncated}
          onRowClick={drillDown}
          resolveLabel={resolveLabel}
          normalizeByVmId={normalizeByVmId}
          palette={paletteCat}
          seriesLimit={view.seriesLimit}
          calcSpecByVmId={calcSpecByVmId}
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
          nextLevel={secondary ? null : nextLevel}
          dimensionLabel={secondary ? secondaryTitle : undefined}
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
          childrenDeltaByLabel={childrenDeltaByLabel}
          childrenDeltaSummary={childrenDeltaSummary}
        />
      )}
    </div>
  );
}