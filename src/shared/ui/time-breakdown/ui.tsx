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

import { memo, useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine, Label,
} from 'recharts';
import { Search, AlertTriangle, ChevronRight, TrendingUp } from 'lucide-react';
import { Card } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { Select, SelectOption } from '@/shared/ui/select';
import { cn } from '@/shared/lib/utils';
import { formatCompactNumber } from '@/shared/lib/utils/format';
import { checkRule, COLOR_STYLES } from '@/shared/lib/utils/metric-colors';
import { groupThresholdsByValue } from '@/shared/lib/utils/thresholds';
import { ThresholdLabel } from '@/shared/ui/threshold-marker';
import type { BreakdownItem } from '@/shared/lib/types/computation';
import type { VirtualMetric } from '@/shared/lib/validators';

/** Серий на чарте по умолчанию (top по сумме выбранной метрики). */
const DEFAULT_SERIES_LIMIT = 8;

const SERIES_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6',
  '#a855f7', '#64748b',
];

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
}

interface PivotRow {
  label: string;
  /** dateLabel → элемент breakdown */
  cells: Map<string, BreakdownItem>;
  /** Сумма выбранной метрики по строке (сортировка и top-N). */
  total: number;
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

  const [searchQuery, setSearchQuery] = useState('');
  // null — авто-режим top-N; Set — явный выбор пользователя
  const [selectedLabels, setSelectedLabels] = useState<Set<string> | null>(null);

  const metricValue = (item: BreakdownItem | undefined): number | null => {
    const vm = item?.virtualMetrics.find(v => v.virtualMetricId === effectiveMetricId);
    return typeof vm?.value === 'number' ? vm.value : null;
  };
  const metricFormatted = (item: BreakdownItem | undefined): string => {
    const vm = item?.virtualMetrics.find(v => v.virtualMetricId === effectiveMetricId);
    return vm?.formattedValue ?? '—';
  };

  // Оси pivot: интервалы хронологически, строки по сумме метрики
  const dates = useMemo(
    () => Array.from(new Set(items.map(i => i.dateLabel ?? ''))).filter(Boolean).sort(),
    [items]
  );

  const rows = useMemo<PivotRow[]>(() => {
    const byLabel = new Map<string, PivotRow>();
    for (const item of items) {
      if (!item.dateLabel) continue;
      let row = byLabel.get(item.label);
      if (!row) {
        row = { label: item.label, cells: new Map(), total: 0 };
        byLabel.set(item.label, row);
      }
      row.cells.set(item.dateLabel, item);
      const v = metricValue(item);
      if (v !== null) row.total += v;
    }
    return Array.from(byLabel.values()).sort((a, b) => b.total - a.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, effectiveMetricId]);

  const chartLabels = useMemo(() => {
    if (selectedLabels) {
      return rows.filter(r => selectedLabels.has(r.label)).map(r => r.label);
    }
    return rows.slice(0, DEFAULT_SERIES_LIMIT).map(r => r.label);
  }, [rows, selectedLabels]);

  const chartLabelSet = useMemo(() => new Set(chartLabels), [chartLabels]);

  const chartData = useMemo(() => {
    const rowByLabel = new Map(rows.map(r => [r.label, r]));
    return dates.map(date => {
      const point: Record<string, string | number | null> = { date };
      for (const label of chartLabels) {
        point[label] = metricValue(rowByLabel.get(label)?.cells.get(date));
      }
      return point;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dates, rows, chartLabels, effectiveMetricId]);

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

  const currentMetric = metricOptions.find(m => m.id === effectiveMetricId);

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
    const v = metricValue(item);
    if (v === null) return null;
    const rule = colorRules.find(r => checkRule(v, r.operator, r.value, r.value2));
    return rule ? COLOR_STYLES[rule.color] : null;
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
            {selectedLabels === null && rows.length > DEFAULT_SERIES_LIMIT && (
              <> (top-{DEFAULT_SERIES_LIMIT}, состав — флажками в таблице)</>
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

      {/* Линейный чарт: динамика выбранной метрики по сериям */}
      <div className="px-4 pt-4 h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
            <YAxis
              tick={{ fontSize: 11 }}
              stroke="#94a3b8"
              tickFormatter={(v: number) => formatCompactNumber(v)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--tooltip-bg, #fff)',
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value) =>
                typeof value === 'number' ? value.toLocaleString('ru-RU') : '—'
              }
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {thresholds.map((group, gi) => (
              <ReferenceLine
                key={`threshold-${gi}`}
                y={group.y}
                stroke={group.primaryColor}
                strokeDasharray={group.isOverlap ? '4 2 1 2' : '6 3'}
                strokeWidth={group.isOverlap ? 2 : 1.5}
                opacity={0.7}
                ifOverflow="extendDomain"
              >
                <Label
                  content={(props) => (
                    <ThresholdLabel
                      viewBox={props.viewBox as { x: number; y: number; width: number; height: number }}
                      value={group.y}
                      group={group}
                    />
                  )}
                />
              </ReferenceLine>
            ))}
            {chartLabels.map((label, i) => (
              <Line
                key={label}
                type="monotone"
                dataKey={label}
                name={display(label)}
                stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                strokeWidth={2}
                dot={dates.length <= 31}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Pivot-таблица: строки — элементы, колонки — интервалы */}
      <div className="overflow-x-auto custom-scrollbar max-h-[480px] overflow-y-auto border-t border-slate-100 dark:border-slate-800">
        <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 w-8" title="Серии на графике" />
              <th
                scope="col"
                className="px-4 py-2 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider sticky left-0 bg-slate-50 dark:bg-slate-900"
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
                title={`Сумма «${currentMetric?.name ?? ''}» по строке`}
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
                <td
                  className={cn(
                    'px-4 py-2 text-sm font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-indigo-50/40 dark:group-hover:bg-indigo-900/10',
                    onRowClick && 'cursor-pointer'
                  )}
                  onClick={() => onRowClick?.(row.label)}
                >
                  <span className="flex items-center gap-1">
                    {display(row.label)}
                    {onRowClick && (
                      <ChevronRight size={13} className="text-slate-300 group-hover:text-indigo-500 transition-colors shrink-0" />
                    )}
                  </span>
                </td>
                {dates.map(d => {
                  const item = row.cells.get(d);
                  return (
                    <td key={d} className="px-4 py-2 text-sm text-right whitespace-nowrap">
                      <span
                        className={cn(
                          'font-mono text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded-md',
                          cellColorClass(item)
                        )}
                      >
                        {metricFormatted(item)}
                      </span>
                    </td>
                  );
                })}
                <td className="px-4 py-2 text-sm text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {formatCompactNumber(row.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
});
