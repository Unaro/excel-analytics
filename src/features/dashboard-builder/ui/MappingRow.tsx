'use client';

import { AlertTriangle, Trash2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Select, SelectOption } from '@/shared/ui/select';
import { resolveColumnMetricId } from '@/shared/lib/utils/dashboard-columns';
import { MappingRowProps } from '../model/types';

export function MappingRow({
  groupConfig,
  virtualMetrics,
  allGroups,
  onUpdateBinding,
  onRemove,
}: MappingRowProps) {
  const fullGroup = allGroups.find(g => g.id === groupConfig.groupId);

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
      <td className="px-4 py-3 font-medium text-sm sticky left-0 bg-white dark:bg-slate-950 group-hover:bg-slate-50 dark:group-hover:bg-slate-900/50 border-r dark:border-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
        {fullGroup.name}
      </td>
      {virtualMetrics.map(vm => {
        // Кандидаты — метрики группы с тем же шаблоном, что у колонки.
        const candidates = fullGroup.metrics.filter(
          m => m.enabled && m.templateId === vm.templateId
        );
        const override = groupConfig.virtualMetricBindings?.find(
          b => b.virtualMetricId === vm.id
        )?.metricId;
        const resolved = resolveColumnMetricId(fullGroup, vm.templateId, override);

        return (
          <td key={vm.id} className="px-4 py-2">
            {candidates.length === 0 ? (
              // В группе нет метрики этого шаблона
              <span className="text-xs text-slate-300 dark:text-slate-600 select-none">—</span>
            ) : candidates.length === 1 ? (
              // Единственный кандидат — привязан автоматически, выбора нет
              <span className="text-xs text-emerald-600 dark:text-emerald-400 truncate block" title="Привязано автоматически">
                {candidates[0].customName || 'авто'}
              </span>
            ) : (
              // Несколько метрик одного шаблона — ручной выбор (override)
              <Select
                className="w-full h-8 rounded border px-2 text-xs focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900 border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300"
                value={resolved || ''}
                onChange={(e) => onUpdateBinding(groupConfig.groupId, vm.id, e.target.value)}
              >
                {candidates.map(metric => (
                  <SelectOption key={metric.id} value={metric.id}>
                    {metric.customName || metric.id.slice(0, 6)}
                  </SelectOption>
                ))}
              </Select>
            )}
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