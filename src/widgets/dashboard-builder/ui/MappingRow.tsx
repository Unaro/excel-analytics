'use client';

import { AlertTriangle, Trash2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Select, SelectOption } from '@/shared/ui/select';
import { useMetricTemplateStore } from '@/entities/metric';
import { cn } from '@/shared/lib/utils';
import type { MappingRowProps } from '../model/types';

export function MappingRow({
  groupConfig,
  virtualMetrics,
  allGroups,
  onUpdateBinding,
  onRemove,
}: MappingRowProps) {
  const fullGroup = allGroups.find(g => g.id === groupConfig.groupId);
  const templates = useMetricTemplateStore(s => s.templates);

  if (!fullGroup) {
    return (
      <tr className="bg-rose-50/40 dark:bg-rose-950/20">
        <td className="px-4 py-3 sticky left-0 bg-rose-50/80 dark:bg-rose-950/40 border-r dark:border-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <AlertTriangle size={14} className="shrink-0" />
            <span className="text-sm font-medium">Группа удалена</span>
          </div>
          <span className="text-[10px] text-rose-400 dark:text-rose-500 font-mono">
            ID: {groupConfig.groupId.slice(0, 12)}…
          </span>
        </td>
        {virtualMetrics.map(vm => (
          <td key={vm.id} className="px-4 py-2">
            <span className="text-xs text-rose-400 dark:text-rose-500 italic">—</span>
          </td>
        ))}
        <td className="px-2 text-center">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500 hover:text-rose-700" onClick={onRemove}>
            <Trash2 size={14} />
          </Button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="group hover:bg-slate-50 dark:hover:bg-slate-900/50">
      <td className="px-4 py-3 font-medium text-sm sticky left-0 bg-white dark:bg-slate-950 group-hover:bg-slate-50 border-r dark:border-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
        {fullGroup.name}
      </td>
      {virtualMetrics.map(vm => {
        const binding = groupConfig.virtualMetricBindings?.find(b => b.virtualMetricId === vm.id);
        return (
          <td key={vm.id} className="px-4 py-2">
            <Select
              className={cn(
                "w-full h-8 rounded border px-2 text-xs focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900",
                binding
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300"
                  : "border-gray-200 text-slate-400 dark:border-slate-800"
              )}
              value={binding?.metricId || ''}
              onChange={(e) => onUpdateBinding(groupConfig.groupId, vm.id, e.target.value)}
            >
              <SelectOption value="">—</SelectOption>
              {fullGroup.metrics.map(metric => {
                const tpl = templates.find(t => t.id === metric.templateId);
                return (
                  <SelectOption key={metric.id} value={metric.id}>
                    {`${metric?.customName || ''}(${tpl?.name || 'Metric'})`}
                  </SelectOption>
                );
              })}
            </Select>
          </td>
        );
      })}
      <td className="px-2 text-center">
        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-500" onClick={onRemove}>
          <Trash2 size={14} />
        </Button>
      </td>
    </tr>
  );
}