'use client';
import { memo, useMemo, useState } from 'react';
import { Search, ChevronRight, Layers } from 'lucide-react';
import { Card } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { cn } from '@/shared/lib/utils';
import { BreakdownItem, VirtualMetricValue, GroupComputationResult } from '@/entities/metric';
import { HierarchyLevel } from '@/entities/hierarchy';
import { SortIcon } from './SortIcon';

interface GroupBreakdownTableProps {
  breakdown: BreakdownItem[];
  summary: GroupComputationResult | null;
  virtualMetrics: VirtualMetricValue[];
  nextLevel: HierarchyLevel | null;
  onDrillDown: (label: string) => void;
  activeMetricIds: string[];
}

export const GroupBreakdownTable = memo(function GroupBreakdownTable({
  breakdown,
  summary,
  virtualMetrics,
  nextLevel,
  onDrillDown,
  activeMetricIds,
}: GroupBreakdownTableProps) {
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  }>({ key: activeMetricIds[0] || 'label', direction: 'desc' });
  const [searchQuery, setSearchQuery] = useState('');

  // Фильтрация активных метрик для таблицы
  const visibleMetrics = useMemo(
    () => virtualMetrics.filter(vm => activeMetricIds.includes(vm.virtualMetricId)),
    [virtualMetrics, activeMetricIds]
  );

  // Сортировка + фильтр (чистый useMemo)
  const sortedBreakdown = useMemo(() => {
    let items = [...breakdown];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(item => item.label.toLowerCase().includes(q));
    }
    items.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;
      if (sortConfig.key === 'label') {
        aVal = a.label;
        bVal = b.label;
      } else if (sortConfig.key === 'recordCount') {
        aVal = a.recordCount;
        bVal = b.recordCount;
      } else {
        const aMetric = a.virtualMetrics.find(m => m.virtualMetricId === sortConfig.key);
        const bMetric = b.virtualMetrics.find(m => m.virtualMetricId === sortConfig.key);
        aVal = aMetric?.value ?? -Infinity;
        bVal = bMetric?.value ?? -Infinity;
      }
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortConfig.direction === 'asc'
          ? aVal.localeCompare(bVal, undefined, { numeric: true })
          : bVal.localeCompare(aVal, undefined, { numeric: true });
      }
      return sortConfig.direction === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
    return items;
  }, [breakdown, searchQuery, sortConfig]);

  const toggleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
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
            ) : (
              <>Сводные данные (достигнут лист)</>
            )}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {breakdown.length} элементов {breakdown.length >= 100 && '(лимит 100)'}
          </p>
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
                  {nextLevel?.displayName || 'Элемент'}
                  <SortIcon active={sortConfig.key === 'label'} direction={sortConfig.direction} />
                </div>
              </th>
              {visibleMetrics.map(vm => (
                <th
                  key={vm.virtualMetricId}
                  scope="col"
                  className="px-6 py-3 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 select-none"
                  onClick={() => toggleSort(vm.virtualMetricId)}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span className="truncate max-w-[150px]" title={vm.virtualMetricName}>
                      {vm.virtualMetricName}
                    </span>
                    <SortIcon active={sortConfig.key === vm.virtualMetricId} direction={sortConfig.direction} />
                  </div>
                </th>
              ))}
              <th
                scope="col"
                className="px-6 py-3 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 select-none"
                onClick={() => toggleSort('recordCount')}
              >
                <div className="flex items-center justify-end gap-1">
                  Записей
                  <SortIcon active={sortConfig.key === 'recordCount'} direction={sortConfig.direction} />
                </div>
              </th>
              {nextLevel && <th scope="col" className="w-10"></th>}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800/50">
            {sortedBreakdown.map((item) => (
              <tr
                key={item.label}
                onClick={() => nextLevel && onDrillDown(item.label)}
                className={cn(
                  "group",
                  nextLevel && "hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10 cursor-pointer transition-colors"
                )}
              >
                <td className="px-6 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">
                  <div className="flex items-center gap-2">
                    {item.label}
                    {nextLevel && (
                      <ChevronRight size={14} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
                    )}
                  </div>
                </td>
                {visibleMetrics.map(vm => {
                  const val = item.virtualMetrics.find(m => m.virtualMetricId === vm.virtualMetricId);
                  return (
                    <td key={vm.virtualMetricId} className="px-6 py-3 text-sm text-right font-mono text-slate-700 dark:text-slate-200">
                      {val?.formattedValue ?? '—'}
                    </td>
                  );
                })}
                <td className="px-6 py-3 text-sm text-right text-slate-500 dark:text-slate-400 font-mono">
                  {item.recordCount.toLocaleString('ru-RU')}
                </td>
                {nextLevel && <td />}
              </tr>
            ))}
            {summary && (
              <tr className="bg-slate-50/50 dark:bg-slate-800/20 font-semibold">
                <td className="px-6 py-3 text-sm text-slate-700 dark:text-slate-200">Итого</td>
                {visibleMetrics.map(vm => (
                  <td key={vm.virtualMetricId} className="px-6 py-3 text-sm text-right font-mono text-slate-900 dark:text-slate-100">
                    {vm.formattedValue}
                  </td>
                ))}
                <td className="px-6 py-3 text-sm text-right text-slate-500 dark:text-slate-400 font-mono">
                  {summary.recordCount.toLocaleString('ru-RU')}
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