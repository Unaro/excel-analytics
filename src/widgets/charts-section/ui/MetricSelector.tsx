'use client';
import { Check } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { VirtualMetric } from '@/shared/lib/validators';

const CHART_COLORS = [
  '#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#3b82f6',
];

interface MetricSelectorProps {
  metric: VirtualMetric;
  isSelected: boolean;
  colorIndex: number;
  onToggle: () => void;
}

export function MetricSelector({ metric, isSelected, colorIndex, onToggle }: MetricSelectorProps) {
  const color = colorIndex >= 0 ? CHART_COLORS[colorIndex % CHART_COLORS.length] : undefined;
  const hasRules = (metric.colorConfig?.rules?.length ?? 0) > 0;

  return (
    <button
      onClick={onToggle}
      className={cn(
        'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors border select-none',
        isSelected
          ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
          : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-500 dark:text-slate-500'
      )}
    >
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'w-2.5 h-2.5 rounded-full transition-all',
            isSelected ? 'scale-100' : 'scale-0 opacity-0'
          )}
          style={{ backgroundColor: color }}
        />
        <span>{metric.name}</span>
        {hasRules && (
          <span className="text-[8px] px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-bold uppercase">
            Пороги
          </span>
        )}
      </div>
      {isSelected && <Check size={14} className="text-slate-400" />}
    </button>
  );
}