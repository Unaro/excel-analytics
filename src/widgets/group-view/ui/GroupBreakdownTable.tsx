'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import { Search, ChevronRight, Layers, AlertTriangle } from 'lucide-react';
import { Card } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { cn } from '@/shared/lib/utils';
import { BreakdownItem, VirtualMetricValue, GroupComputationResult } from '@/entities/metric';
import { HierarchyLevel } from '@/entities/hierarchy';
import { VirtualMetric } from '@/shared/lib/validators';
import { GroupMetricConfigPopover } from '@/features/configure-group-metric';
import { GroupMetricCell } from '@/entities/group-metric-config';
import { SortIcon } from '@/shared/ui/sort-icon';
import { sortBreakdownItems } from '../lib/sort-breakdown';
import type { SortConfig } from '../model/types';

interface GroupBreakdownTableProps {
  breakdown: BreakdownItem[];
  summary: GroupComputationResult | null;
  virtualMetrics: VirtualMetricValue[];
  metricMetas: VirtualMetric[];
  nextLevel: HierarchyLevel | null;
  onDrillDown: (label: string) => void;
  activeMetricIds: string[];
  sortConfig: SortConfig | null;
  onSortChange: (config: SortConfig) => void;
  groupId: string;
  groupMetricIds: string[];
  /** metricId группы → templateId: для CF-ячейки (единый источник на шаблоне). */
  metricTemplateIds?: Record<string, string>;
  /**
   * Метка измерения при временно́й группировке (например «Дата · месяц»).
   * Передаётся вместе с nextLevel=null: drill-down по датам невозможен.
   */
  dimensionLabel?: string;
  /**
   * Подстановка справочника: код → наименование (только отображение;
   * в drill-down и ключи уходит исходный label).
   */
  resolveLabel?: (label: string) => string;
}

export const GroupBreakdownTable = memo(function GroupBreakdownTable({
  breakdown,
  summary,
  virtualMetrics,
  metricMetas,
  nextLevel,
  onDrillDown,
  activeMetricIds,
  sortConfig,
  onSortChange,
  groupId,
  groupMetricIds,
  metricTemplateIds,
  dimensionLabel,
  resolveLabel,
}: GroupBreakdownTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const display = useMemo(
    () => resolveLabel ?? ((label: string) => label),
    [resolveLabel]
  );

  const visibleMetrics = useMemo(
    () => virtualMetrics.filter(vm => activeMetricIds.includes(vm.virtualMetricId)),
    [virtualMetrics, activeMetricIds]
  );

  const sortedBreakdown = useMemo(() => {
    let items = [...breakdown];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      // Поиск и по коду, и по наименованию из справочника
      items = items.filter(item =>
        item.label.toLowerCase().includes(q) ||
        display(item.label).toLowerCase().includes(q)
      );
    }
    if (sortConfig) {
      items = sortBreakdownItems(items, sortConfig.key, sortConfig.direction);
    }
    return items;
  }, [breakdown, searchQuery, sortConfig, display]);

  const vmIdToGroupMetricId = useMemo(() => {
    const map = new Map<string, string>();
    for (const vm of metricMetas) {
      if (vm.sourceMetricId) {
        map.set(vm.id, vm.sourceMetricId);
      }
    }
    return map;
  }, [metricMetas]);

  const toggleSort = (key: string) => {
    onSortChange({
      key,
      direction: sortConfig?.key === key && sortConfig?.direction === 'desc' ? 'asc' : 'desc',
    });
  };

  if (breakdown.length === 0) {
    return (
      <Card className="p-12 text-center text-slate-400">
        <Layers size={32} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm font-medium">Нет данных для разбивки</p>
      </Card>
    );
  }

  return (
    <Card className="p-0 overflow-hidden relative">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            {nextLevel ? (
              <>Разбивка по: <Badge variant="outline">{nextLevel.displayName}</Badge></>
            ) : dimensionLabel ? (
              <>Разбивка по: <Badge variant="outline">{dimensionLabel}</Badge></>
            ) : (
              <>Сводные данные (достигнут лист)</>
            )}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {breakdown.length} элементов
          </p>
          {summary?.breakdownTruncated && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
              <AlertTriangle size={12} className="shrink-0" />
              Разбивка усечена: показаны первые {breakdown.length} значений.
              Строки за пределами лимита не учтены в таблице и «Итого» — уточните фильтры.
            </p>
          )}
        </div>
        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по строкам..."
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="overflow-x-auto custom-scrollbar">
        <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-slate-900/50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 select-none"
                onClick={() => toggleSort('label')}
              >
                <div className="flex items-center gap-1">
                  {nextLevel?.displayName || dimensionLabel || 'Элемент'}
                  <SortIcon active={sortConfig?.key === 'label'} direction={sortConfig?.direction ?? 'desc'} />
                </div>
              </th>
              {visibleMetrics.map(vm => {
                const groupMetricId = vmIdToGroupMetricId.get(vm.virtualMetricId) ?? null;
                const metricConfig = metricMetas.find(c => c.id === vm.virtualMetricId);
                return (
                  <th
                    key={vm.virtualMetricId}
                    scope="col"
                    className="px-6 py-3 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 select-none group/th"
                    onClick={() => toggleSort(vm.virtualMetricId)}
                  >
                    <div className="flex items-center justify-end gap-1">
                      {groupMetricId && (
                        <GroupMetricConfigPopover
                          groupId={groupId}
                          metricId={groupMetricId}
                          templateId={metricTemplateIds?.[groupMetricId]}
                          metricName={vm.virtualMetricName}
                        />
                      )}
                      <span className="truncate max-w-[150px]" title={vm.virtualMetricName}>
                        {vm.virtualMetricName}
                      </span>
                      {metricConfig?.unit && (
                        <span className="text-[10px] text-slate-400 lowercase bg-slate-100 dark:bg-slate-800 px-1.5 rounded">
                          {metricConfig.unit}
                        </span>
                      )}
                      <SortIcon active={sortConfig?.key === vm.virtualMetricId} direction={sortConfig?.direction ?? 'desc'} />
                    </div>
                  </th>
                );
              })}
              <th
                scope="col"
                className="px-6 py-3 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 select-none"
                onClick={() => toggleSort('recordCount')}
              >
                <div className="flex items-center justify-end gap-1">
                  Записей
                  <SortIcon active={sortConfig?.key === 'recordCount'} direction={sortConfig?.direction ?? 'desc'} />
                </div>
              </th>
              {nextLevel && <th scope="col" className="w-10"></th>}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800/50">
            {sortedBreakdown.map((item) => (
              <tr
                // Составной ключ: во время переключения режимов breakdown
                // может транзиентно содержать 2-D строки с повторяющимся label
                key={`${item.label} ${item.dateLabel ?? ''}`}
                onClick={() => nextLevel && onDrillDown(item.label)}
                className={cn(
                  "group",
                  nextLevel && "hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10 cursor-pointer transition-colors"
                )}
              >
                <td className="px-6 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">
                  <div className="flex items-center gap-2">
                    {display(item.label)}
                    {nextLevel && (
                      <ChevronRight size={14} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
                    )}
                  </div>
                </td>
                {visibleMetrics.map((vm) => {
                  const val = item.virtualMetrics.find(m => m.virtualMetricId === vm.virtualMetricId);
                  const meta = metricMetas.find(c => c.id === vm.virtualMetricId);
                  const groupMetricId = vmIdToGroupMetricId.get(vm.virtualMetricId) ?? null;
                  return (
                    <td key={vm.virtualMetricId} className="px-6 py-3 text-sm text-right">
                      {val && meta && groupMetricId ? (
                        <GroupMetricCell
                          groupId={groupId}
                          metricId={groupMetricId}
                          templateId={metricTemplateIds?.[groupMetricId]}
                          value={val.value}
                          formattedValue={val.formattedValue}
                          displayFormat={meta.displayFormat}
                          decimalPlaces={meta.decimalPlaces}
                          unit={meta.unit}
                        />
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600 select-none">−</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-6 py-3 text-sm text-right text-slate-500 dark:text-slate-400 font-mono">
                  {/* ✅ ИСПРАВЛЕНИЕ: защита от null/undefined */}
                  {(item.recordCount ?? 0).toLocaleString('ru-RU')}
                </td>
                {nextLevel && <td />}
              </tr>
            ))}
            {summary && (
              <tr className="bg-slate-50/50 dark:bg-slate-800/20 font-semibold">
                <td className="px-6 py-3 text-sm text-slate-700 dark:text-slate-200">Итого</td>
                {visibleMetrics.map(vm => {
                  const meta = metricMetas.find(c => c.id === vm.virtualMetricId);
                  const groupMetricId = vmIdToGroupMetricId.get(vm.virtualMetricId) ?? null;
                  return (
                    <td key={vm.virtualMetricId} className="px-6 py-3 text-sm text-right">
                      {meta && groupMetricId ? (
                        <GroupMetricCell
                          groupId={groupId}
                          metricId={groupMetricId}
                          templateId={metricTemplateIds?.[groupMetricId]}
                          value={vm.value}
                          formattedValue={vm.formattedValue}
                          displayFormat={meta.displayFormat}
                          decimalPlaces={meta.decimalPlaces}
                          unit={meta.unit}
                        />
                      ) : (
                        <span className="font-mono text-slate-900 dark:text-slate-100">
                          {vm.formattedValue}
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="px-6 py-3 text-sm text-right text-slate-500 dark:text-slate-400 font-mono">
                  {(summary.recordCount ?? 0).toLocaleString('ru-RU')}
                </td>
                {nextLevel && <td />}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
});