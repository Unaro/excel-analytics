'use client';

// ─────────────────────────────────────────────────────────────
// Секция двумерного breakdown: категория × время.
//
// Проблема объёма данных решается так:
//  - на чарте одна метрика (селектор) и ограниченный набор серий:
//    по умолчанию top-N элементов по сумме метрики, состав серий
//    управляется чекбоксами в строках pivot-таблицы;
//  - pivot-таблица показывает ВСЕ элементы (поиск + вертикальный скролл),
//    интервалы — колонки с горизонтальным скроллом.
//
// Переиспользуется страницей группы (серии = элементы иерархии)
// и дашбордом (серии = группы показателей).
// ─────────────────────────────────────────────────────────────

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend,
} from 'recharts';
import { ScrollableChart } from '@/shared/ui/scrollable-chart';
import { Search, AlertTriangle, ChevronRight, TrendingUp, Grid2x2 } from 'lucide-react';
import { Card } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { Select, SelectOption } from '@/shared/ui/select';
import { cn } from '@/shared/lib/utils';
import { formatCompactNumber } from '@/shared/lib/utils/format';
import { CATEGORY_SERIES_COLORS as SERIES_COLORS } from '@/shared/lib/utils/chart-palette';
import { effectiveChartFormat } from '@/shared/lib/utils/chart-format';
import { ChartTooltip } from '@/shared/ui/chart-tooltip';
import { checkRule, COLOR_STYLES, toDisplayScale, formatDisplayValue } from '@/shared/lib/utils/metric-colors';
import { formatValue } from '@/shared/lib/computation/lib/utils';
import { type NormalizeConfig } from '@/shared/lib/utils/normalize';
import {
  buildPivotDates,
  buildPivotRows,
  buildDateRefs,
  pivotGrandTotal,
  metricValueOf,
  cellRatioOf,
  type PivotRow,
} from './pivot';
import { heatmapExtent, heatmapColor } from './heatmap';
import { groupThresholdsByValue } from '@/shared/lib/utils/thresholds';
import { renderThresholdReferenceLines } from '@/shared/ui/threshold-marker';
import type { BreakdownItem } from '@/shared/lib/types/computation';
import type { VirtualMetric } from '@/shared/lib/validators';

/** Серий на чарте по умолчанию (top по сумме выбранной метрики). */
const DEFAULT_SERIES_LIMIT = 8;

export interface TimeBreakdownSectionProps {
  /** Элементы breakdown с заполненным dateLabel (категория × время). */
  items: BreakdownItem[];
  /** Метаданные метрик для селектора (id, name, unit). */
  metricMetas: VirtualMetric[];
  /** Видимые метрики; не задано — все из metricMetas. */
  activeMetricIds?: string[];
  /** Название категориального измерения («Город», «Группа»). */
  dimensionTitle: string;
  /** Название временно́го измерения («Дата · месяцы»). */
  dateTitle: string;
  /** Разбивка усечена лимитом строк SQL. */
  truncated?: boolean;
  /** Клик по названию строки (drill-down). Не задан — строки не кликабельны. */
  onRowClick?: (label: string) => void;
  /**
   * Подстановка справочника: код → наименование (только отображение;
   * в onRowClick, ключи строк и dataKey чарта уходит исходный label).
   */
  resolveLabel?: (label: string) => string;
  /**
   * Кросс-столбцовая нормализация (% от итога/макс/…): virtualMetricId →
   * {база, точность}. В 2-D считается ПО ПЕРИОДАМ: доля от ориентира по столбцу
   * каждой даты (обобщает 1-D). Ячейки и чарт — в процентах, Σ-столбец — общая
   * доля строки (итог строки ÷ общий итог). Нет записи = абсолютные значения.
   */
  normalizeByVmId?: Map<string, NormalizeConfig>;
  /** Палитра цветов категорий-серий (из group.paletteId). Дефолт — CATEGORY_SERIES_COLORS. */
  palette?: string[];
  /** Сколько серий показывать по умолчанию (top-N по сумме метрики). Дефолт — 8. */
  seriesLimit?: number;
}

export const TimeBreakdownSection = memo(function TimeBreakdownSection({
  items,
  metricMetas,
  activeMetricIds,
  dimensionTitle,
  dateTitle,
  truncated,
  onRowClick,
  resolveLabel,
  normalizeByVmId,
  palette = SERIES_COLORS,
  seriesLimit,
}: TimeBreakdownSectionProps) {
  const display = useMemo(
    () => resolveLabel ?? ((label: string) => label),
    [resolveLabel]
  );
  const metricOptions = useMemo(
    () =>
      activeMetricIds
        ? metricMetas.filter(m => activeMetricIds.includes(m.id))
        : metricMetas,
    [metricMetas, activeMetricIds]
  );

  const [metricId, setMetricId] = useState<string>('');
  const effectiveMetricId = metricId || metricOptions[0]?.id || '';

  const currentMetric = metricOptions.find(m => m.id === effectiveMetricId);
  // Нормализация выбранной метрики (2-D — по периодам, см. dateRefs ниже):
  // доля показывается процентом, поэтому формат/масштаб → percent.
  const normCfg = normalizeByVmId?.get(effectiveMetricId);
  const isNormalized = !!normCfg;
  const normDecimals = normCfg?.decimalPlaces ?? currentMetric?.decimalPlaces ?? 1;
  const effectiveFormat = effectiveChartFormat(currentMetric?.displayFormat, isNormalized);

  const [searchQuery, setSearchQuery] = useState('');
  // Тепловая карта: окраска ячеек pivot градиентом по значению (эфемерно, как
  // остальные 2-D-контролы). Заменяет CF-окраску, пока включена.
  const [heatmap, setHeatmap] = useState(false);
  // null — авто-режим top-N; Set — явный выбор пользователя
  const [selectedLabels, setSelectedLabels] = useState<Set<string> | null>(null);
  // Сколько серий показывать по умолчанию (top-N по сумме метрики).
  const effectiveSeriesLimit = seriesLimit ?? DEFAULT_SERIES_LIMIT;

  // Чарт и pivot-таблица — одна ось дат: их горизонтальные скроллы связаны,
  // чтобы листать вместе (а не наводиться на каждый скроллбар отдельно).
  // Пропорционально по доле прокрутки — устойчиво к разной ширине контента.
  const chartScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);
  const syncScroll = (from: HTMLDivElement | null, to: HTMLDivElement | null) => {
    if (!from || !to || syncingRef.current) return;
    const fromMax = from.scrollWidth - from.clientWidth;
    const toMax = to.scrollWidth - to.clientWidth;
    if (fromMax <= 0 || toMax <= 0) return;
    const target = (from.scrollLeft / fromMax) * toMax;
    if (Math.abs(to.scrollLeft - target) < 1) return;
    syncingRef.current = true;
    to.scrollLeft = target;
    requestAnimationFrame(() => { syncingRef.current = false; });
  };

  const metricValue = (item: BreakdownItem | undefined): number | null =>
    metricValueOf(item, effectiveMetricId);
  const metricFormatted = (item: BreakdownItem | undefined): string => {
    if (isNormalized) {
      const r = cellRatio(item);
      return r === null ? '—' : formatValue(r, 'percent', normDecimals);
    }
    const vm = item?.virtualMetrics.find(v => v.virtualMetricId === effectiveMetricId);
    return vm?.formattedValue ?? '—';
  };

  // Оси pivot: интервалы хронологически, строки по сумме метрики
  const dates = useMemo(() => buildPivotDates(items), [items]);

  const rows = useMemo<PivotRow[]>(
    () => buildPivotRows(items, effectiveMetricId),
    [items, effectiveMetricId]
  );

  // Нормализация ПО ПЕРИОДАМ: ориентир (знаменатель) — по столбцу каждой даты
  // (доля от суммы/макс/… по всем категориям внутри периода). Обобщает 1-D.
  const dateRefs = useMemo(
    () => (isNormalized ? buildDateRefs(rows, dates, effectiveMetricId, normCfg!.base) : null),
    [isNormalized, dates, rows, effectiveMetricId, normCfg]
  );

  // Общий итог метрики — знаменатель Σ-столбца (доля строки в общем итоге).
  const grandTotal = useMemo(() => pivotGrandTotal(rows), [rows]);

  // Значение ячейки для показа/окраски/чарта: абсолют или доля (по периоду).
  const cellRatio = (item: BreakdownItem | undefined): number | null =>
    cellRatioOf(item, effectiveMetricId, dateRefs);

  // Колесо мыши → горизонтальный скролл (вертикального колеса на широком
  // 2D-чарте/таблице нет, листать иначе неудобно). Нативный листенер с
  // passive:false — React вешает onWheel пассивно, и preventDefault не
  // сработал бы. Перехватываем только при горизонтальном переполнении и
  // ОТСУТСТВИИ вертикального (у высокой таблицы колесо листает строки).
  useEffect(() => {
    const els = [chartScrollRef.current, tableScrollRef.current].filter(
      (el): el is HTMLDivElement => el !== null
    );
    const onWheel = (e: WheelEvent) => {
      const el = e.currentTarget as HTMLDivElement;
      const canX = el.scrollWidth > el.clientWidth;
      const canY = el.scrollHeight > el.clientHeight;
      if (!canX || canY || e.deltaY === 0) return;
      const atStart = el.scrollLeft <= 0;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
      // На границах отдаём событие странице (вертикальный скролл страницы).
      if ((e.deltaY < 0 && atStart) || (e.deltaY > 0 && atEnd)) return;
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    };
    els.forEach((el) => el.addEventListener('wheel', onWheel, { passive: false }));
    return () => els.forEach((el) => el.removeEventListener('wheel', onWheel));
  }, [dates.length, rows.length]);

  const chartLabels = useMemo(() => {
    if (selectedLabels) {
      return rows.filter(r => selectedLabels.has(r.label)).map(r => r.label);
    }
    return rows.slice(0, effectiveSeriesLimit).map(r => r.label);
  }, [rows, selectedLabels, effectiveSeriesLimit]);

  const chartLabelSet = useMemo(() => new Set(chartLabels), [chartLabels]);

  const chartData = useMemo(() => {
    const rowByLabel = new Map(rows.map(r => [r.label, r]));
    return dates.map(date => {
      const point: Record<string, string | number | null> = { date };
      for (const label of chartLabels) {
        // Масштаб отображения, как и порог-линия (group.y): percent доля → %.
        // Нормализованная метрика → доля по периоду, формат percent.
        const cell = rowByLabel.get(label)?.cells.get(date);
        const v = isNormalized ? cellRatio(cell) : metricValue(cell);
        point[label] = v === null ? null : toDisplayScale(v, effectiveFormat);
      }
      return point;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dates, rows, chartLabels, effectiveMetricId, isNormalized]);

  const toggleLabel = (label: string) => {
    setSelectedLabels(prev => {
      // Первый клик в авто-режиме: фиксируем текущий top-N как явный выбор
      const next = new Set(prev ?? chartLabelSet);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const visibleRows = useMemo(() => {
    if (!searchQuery) return rows;
    const q = searchQuery.toLowerCase();
    // Поиск и по коду, и по наименованию из справочника
    return rows.filter(r =>
      r.label.toLowerCase().includes(q) ||
      display(r.label).toLowerCase().includes(q)
    );
  }, [rows, searchQuery, display]);

  // Пороговые линии условного форматирования выбранной метрики
  // (метаданные метрики должны нести colorConfig)
  const thresholds = useMemo(
    () => groupThresholdsByValue(metricMetas, [effectiveMetricId]),
    [metricMetas, effectiveMetricId]
  );
  const colorRules = currentMetric?.colorConfig?.rules;

  /** CSS-классы окраски ячейки по правилам условного форматирования. */
  const cellColorClass = (item: BreakdownItem | undefined): string | null => {
    if (!colorRules || colorRules.length === 0) return null;
    const v = cellRatio(item);
    if (v === null) return null;
    // Порог — в масштабе отображения (для percent/нормализации в процентах)
    const scaled = toDisplayScale(v, effectiveFormat);
    const rule = colorRules.find(r => checkRule(scaled, r.operator, r.value, r.value2));
    return rule ? COLOR_STYLES[rule.color] : null;
  };

  // Тепловая карта: единый экстент по всем ячейкам (строки×даты) выбранной
  // метрики в display-масштабе; фон ячейки — градиент по интенсивности.
  const heatExtent = useMemo(() => {
    if (!heatmap) return null;
    const vals: (number | null)[] = [];
    for (const r of rows) {
      for (const d of dates) {
        const cell = r.cells.get(d);
        const v = isNormalized ? cellRatio(cell) : metricValue(cell);
        vals.push(v === null ? null : toDisplayScale(v, effectiveFormat));
      }
    }
    return heatmapExtent(vals);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heatmap, rows, dates, isNormalized, effectiveMetricId, dateRefs, effectiveFormat]);

  const cellHeat = (item: BreakdownItem | undefined): string | undefined => {
    if (!heatmap) return undefined;
    const v = isNormalized ? cellRatio(item) : metricValue(item);
    return heatmapColor(v === null ? null : toDisplayScale(v, effectiveFormat), heatExtent);
  };

  if (rows.length === 0 || dates.length === 0) {
    return (
      <Card className="p-12 text-center text-slate-400">
        <TrendingUp size={32} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm font-medium">Нет данных для временно́й разбивки</p>
      </Card>
    );
  }

  return (
    <Card className="p-0 overflow-hidden">
      {/* Заголовок и контролы */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
            <Badge variant="outline">{dimensionTitle}</Badge>
            <span className="text-slate-400">×</span>
            <Badge variant="outline">{dateTitle}</Badge>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {rows.length} элементов · {dates.length} интервалов · на графике{' '}
            {chartLabels.length}
            {selectedLabels === null && rows.length > effectiveSeriesLimit && (
              <> (top-{effectiveSeriesLimit}, состав — флажками в таблице)</>
            )}
          </p>
          {truncated && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
              <AlertTriangle size={12} className="shrink-0" />
              Данные усечены лимитом строк — уточните фильтры или укрупните размерность.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Линия/столбцы 2-D задаёт стиль ВЫБРАННОЙ метрики на её KPI-карточке
              (единый контрол, как в 1-D) — отдельного тоггла здесь нет. */}
          <button
            type="button"
            onClick={() => setHeatmap(h => !h)}
            aria-pressed={heatmap}
            title="Тепловая карта (окраска ячеек по значению)"
            className={cn(
              'px-2.5 h-9 flex items-center rounded-lg border transition-colors shrink-0',
              heatmap
                ? 'bg-indigo-500 text-white border-indigo-500'
                : 'bg-white dark:bg-slate-950 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900'
            )}
          >
            <Grid2x2 size={14} />
          </button>
          {metricOptions.length > 1 && (
            <Select
              className="w-52 h-9 text-sm"
              value={effectiveMetricId}
              onChange={e => setMetricId(e.target.value)}
            >
              {metricOptions.map(m => (
                <SelectOption key={m.id} value={m.id}>{m.name}</SelectOption>
              ))}
            </Select>
          )}
          <div className="relative w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Поиск..."
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Чарт: динамика выбранной метрики по сериям (линии или столбцы).
          При многих интервалах — горизонтальный скролл внутри бокса,
          чтобы точки/подписи не сжимались, а страница не растягивалась.
          Оси/тултип/пороги общие для обоих типов (вынесены в переменные —
          recharts распознаёт их по типу элемента, не по месту). */}
      <div className="px-4 pt-4">
        <ScrollableChart
          ref={chartScrollRef}
          onScroll={() => syncScroll(chartScrollRef.current, tableScrollRef.current)}
          slotCount={dates.length}
          slotWidth={56}
          height={304}
        >
          {(() => {
            const grid = <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" />;
            const xAxis = <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />;
            const yAxis = (
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="#94a3b8"
                tickFormatter={(v: number) => formatCompactNumber(v)}
              />
            );
            const tooltip = (
              <Tooltip
                content={(props) => {
                  const { active, payload, label } = props;
                  if (!active || !payload || !payload.length) return null;
                  const rows = payload.map((entry) => ({
                    color: entry.color ?? '#6366f1',
                    name: display(String(entry.dataKey ?? '')),
                    value: typeof entry.value === 'number'
                      ? formatDisplayValue(entry.value, effectiveFormat, isNormalized ? undefined : currentMetric?.unit)
                      : '—',
                  }));
                  return <ChartTooltip title={label} rows={rows} />;
                }}
              />
            );
            const legend = <Legend wrapperStyle={{ fontSize: 11 }} />;
            const margin = { top: 8, right: 16, bottom: 4, left: 8 };
            // Вид 2-D полностью задаёт chartStyle ВЫБРАННОЙ метрики на её
            // KPI-карточке (единый контрол, как в 1-D): kind=bar/line/area —
            // столбцы, линии или области; curve/dash — стиль обводки. Все
            // серии-категории этой метрики рисуются единым стилем.
            const styleKind = currentMetric?.chartStyle?.kind;
            const chartKind = styleKind === 'area' ? 'area' : styleKind === 'line' ? 'line' : 'bar';
            const lineCurve = currentMetric?.chartStyle?.curve === 'linear' ? 'linear' : 'monotone';
            const lineDash = currentMetric?.chartStyle?.dash === 'dashed' ? '6 4' : undefined;

            if (chartKind === 'bar') {
              return (
                <BarChart data={chartData} margin={margin}>
                  {grid}{xAxis}{yAxis}{tooltip}{legend}
                  {renderThresholdReferenceLines(thresholds)}
                  {chartLabels.map((label, i) => (
                    <Bar
                      key={label}
                      dataKey={label}
                      name={display(label)}
                      fill={palette[i % palette.length]}
                    />
                  ))}
                </BarChart>
              );
            }

            if (chartKind === 'area') {
              return (
                <AreaChart data={chartData} margin={margin}>
                  {grid}{xAxis}{yAxis}{tooltip}{legend}
                  {renderThresholdReferenceLines(thresholds)}
                  {chartLabels.map((label, i) => {
                    const c = palette[i % palette.length];
                    return (
                      <Area
                        key={label}
                        type={lineCurve}
                        dataKey={label}
                        name={display(label)}
                        stroke={c}
                        strokeWidth={2}
                        strokeDasharray={lineDash}
                        fill={c}
                        fillOpacity={0.2}
                        dot={dates.length <= 31}
                        connectNulls
                      />
                    );
                  })}
                </AreaChart>
              );
            }

            return (
              <LineChart data={chartData} margin={margin}>
                {grid}{xAxis}{yAxis}{tooltip}{legend}
                {renderThresholdReferenceLines(thresholds)}
                {chartLabels.map((label, i) => (
                  <Line
                    key={label}
                    type={lineCurve}
                    dataKey={label}
                    name={display(label)}
                    stroke={palette[i % palette.length]}
                    strokeWidth={2}
                    strokeDasharray={lineDash}
                    dot={dates.length <= 31}
                    connectNulls
                  />
                ))}
              </LineChart>
            );
          })()}
        </ScrollableChart>
      </div>

      {/* Pivot-таблица: строки — элементы, колонки — интервалы.
          Горизонталь синхронизирована с чартом, вертикаль скроллится внутри. */}
      <div
        ref={tableScrollRef}
        onScroll={() => syncScroll(tableScrollRef.current, chartScrollRef.current)}
        className="overflow-x-auto custom-scrollbar max-h-[480px] overflow-y-auto border-t border-slate-100 dark:border-slate-800"
      >
        <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 w-8" title="Серии на графике" />
              <th
                scope="col"
                className="px-4 py-2 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider sticky left-0 z-20 bg-slate-50 dark:bg-slate-900"
              >
                {dimensionTitle}
              </th>
              {dates.map(d => (
                <th
                  key={d}
                  scope="col"
                  className="px-4 py-2 text-right text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider whitespace-nowrap"
                >
                  {d}
                </th>
              ))}
              <th
                scope="col"
                className="px-4 py-2 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                title={
                  isNormalized
                    ? `Доля «${currentMetric?.name ?? ''}» строки в общем итоге`
                    : `Сумма «${currentMetric?.name ?? ''}» по строке`
                }
              >
                Σ
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800/50">
            {visibleRows.map(row => (
              <tr key={row.label} className="group hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10 transition-colors">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={chartLabelSet.has(row.label)}
                    onChange={() => toggleLabel(row.label)}
                    className="accent-indigo-600 cursor-pointer"
                    aria-label={`Показать «${row.label}» на графике`}
                  />
                </td>
                {/* Липкая колонка: непрозрачный фон + z-10 (иначе ячейки дат
                    просвечивают/наезжают при горизонтальном скролле), длинная
                    метка обрезается (truncate + title). */}
                <td
                  className={cn(
                    'px-4 py-2 text-sm font-medium text-slate-900 dark:text-slate-100 sticky left-0 z-10 bg-white dark:bg-slate-900 group-hover:bg-indigo-50 dark:group-hover:bg-slate-800 max-w-[240px]',
                    onRowClick && 'cursor-pointer'
                  )}
                  onClick={() => onRowClick?.(row.label)}
                >
                  <span className="flex items-center gap-1 min-w-0">
                    <span className="truncate" title={display(row.label)}>{display(row.label)}</span>
                    {onRowClick && (
                      <ChevronRight size={13} className="text-slate-300 group-hover:text-indigo-500 transition-colors shrink-0" />
                    )}
                  </span>
                </td>
                {dates.map(d => {
                  const item = row.cells.get(d);
                  const heat = cellHeat(item);
                  return (
                    <td key={d} className="px-4 py-2 text-sm text-right whitespace-nowrap">
                      <span
                        className={cn(
                          'font-mono text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded-md',
                          !heatmap && cellColorClass(item)
                        )}
                        style={heat ? { backgroundColor: heat } : undefined}
                      >
                        {metricFormatted(item)}
                      </span>
                    </td>
                  );
                })}
                <td className="px-4 py-2 text-sm text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {isNormalized
                    ? grandTotal
                      ? formatValue(row.total / grandTotal, 'percent', normDecimals)
                      : '—'
                    : formatCompactNumber(row.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
});
