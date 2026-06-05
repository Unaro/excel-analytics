'use client';

import { BarChart3, Radar } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { LucideIcon } from 'lucide-react';
import type { ChartType } from '../model/types';

interface ChartOption {
  type: ChartType;
  label: string;
  icon: LucideIcon;
  color: string;
}

const CHART_OPTIONS: ChartOption[] = [
  { type: 'bar', label: 'Столбцы', icon: BarChart3, color: 'indigo' },
  { type: 'radar', label: 'Радар', icon: Radar, color: 'purple' }
];

interface ChartTypeSelectorProps {
  selected: ChartType[];
  onChange: (types: ChartType[]) => void;
}

export function ChartTypeSelector({ selected, onChange }: ChartTypeSelectorProps) {
  const toggle = (type: ChartType) => {
    if (selected.includes(type)) {
      if (selected.length === 1) return;
      onChange(selected.filter(t => t !== type));
    } else {
      onChange([...selected, type]);
    }
  };

  return (
    <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
      {CHART_OPTIONS.map(option => {
        const Icon = option.icon;
        const isSelected = selected.includes(option.type);
        return (
          <button
            key={option.type}
            onClick={() => toggle(option.type)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
              isSelected
                ? `bg-white dark:bg-slate-700 shadow-sm text-${option.color}-600 dark:text-${option.color}-300`
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            )}
            title={option.label}
          >
            <Icon size={14} />
            <span className="hidden sm:inline">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}