'use client';
import { memo } from 'react';
import { Calculator, Check } from 'lucide-react';
import { Card } from '@/shared/ui/card';
import { cn } from '@/shared/lib/utils';
import { VirtualMetricValue } from '@/entities/metric';

interface GroupKpiCardProps {
  metric: VirtualMetricValue;
  isActive: boolean;
  activeIndex: number;
  totalActive: number;
  recordCount: number;
  onToggle: (id: string) => void;
}

/**
 * КЛИКАБЛЬНАЯ KPI-карточка. 
 * Активная карточка подсвечивается цветом и отображает свою позицию в активных.
 */
export const GroupKpiCard = memo(function GroupKpiCard({
  metric,
  isActive,
  activeIndex,
  totalActive,
  recordCount,
  onToggle,
}: GroupKpiCardProps) {
  // Цвета для активных метрик (чередуются)
  const ACTIVE_COLORS = [
    'border-indigo-400 bg-indigo-50/50 dark:border-indigo-600 dark:bg-indigo-950/30',
    'border-purple-400 bg-purple-50/50 dark:border-purple-600 dark:bg-purple-950/30',
    'border-emerald-400 bg-emerald-50/50 dark:border-emerald-600 dark:bg-emerald-950/30',
    'border-amber-400 bg-amber-50/50 dark:border-amber-600 dark:bg-amber-950/30',
    'border-rose-400 bg-rose-50/50 dark:border-rose-600 dark:bg-rose-950/30',
  ];

  return (
    <Card
      onClick={() => onToggle(metric.virtualMetricId)}
      className={cn(
        "p-5 flex flex-col justify-between cursor-pointer select-none",
        "hover:shadow-md transition-all",
        isActive
          ? ACTIVE_COLORS[activeIndex % ACTIVE_COLORS.length]
          : "border-slate-200 dark:border-slate-800 opacity-60 hover:opacity-100"
      )}
    >
      <div className="flex justify-between items-start mb-2">
        <span
          className="text-xs font-medium text-slate-600 dark:text-slate-400 line-clamp-2 h-8"
          title={metric.virtualMetricName}
        >
          {metric.virtualMetricName}
        </span>
        {isActive ? (
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-white/70 dark:bg-slate-900/70 rounded-full px-1.5 py-0.5">
              #{activeIndex + 1}
            </span>
            <div className="p-1 bg-indigo-600 rounded-full">
              <Check size={10} className="text-white" />
            </div>
          </div>
        ) : (
          <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-400">
            <Calculator size={12} />
          </div>
        )}
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          {metric.value === null ? <span className="text-slate-300">—</span> : metric.formattedValue}
        </div>
        {recordCount > 0 && (
          <div className="text-[10px] text-slate-400 mt-1">
            {recordCount.toLocaleString('ru-RU')} записей
          </div>
        )}
      </div>
    </Card>
  );
});