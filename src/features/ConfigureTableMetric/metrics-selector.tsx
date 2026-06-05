'use client';

import * as Popover from '@radix-ui/react-popover';
import { Settings2, Check } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { VirtualMetric } from '@/shared/lib/validators';

interface MetricsSelectorProps {
  metrics: VirtualMetric[];
  hiddenMetricIds: string[];
  onToggleMetric: (id: string) => void;
}

export function MetricsSelector({
  metrics,
  hiddenMetricIds,
  onToggleMetric,
}: MetricsSelectorProps) {
  const activeCount = metrics.length - hiddenMetricIds.length;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            'flex items-center gap-2 px-3 py-2 border rounded-md transition text-sm font-medium shadow-sm',
            'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800',
            'text-slate-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800',
            // Стилизация активного состояния от Radix
            'data-[state=open]:bg-slate-100 data-[state=open]:dark:bg-slate-800',
            'data-[state=open]:border-slate-300 data-[state=open]:dark:border-slate-600',
            'data-[state=open]:text-slate-900 data-[state=open]:dark:text-white',
            'focus:outline-none focus:ring-2 focus:ring-indigo-500/50'
          )}
        >
          <Settings2 size={16} />
          <span className="hidden sm:inline">Таблица</span>
          <span className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 text-[10px] py-0.5 px-1.5 rounded-md ml-1 min-w-5 text-center">
            {activeCount}
          </span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="end"
          sideOffset={8}
          collisionPadding={10}
          className={cn(
            'w-64 flex flex-col max-h-[400px]',
            'bg-white dark:bg-slate-900 rounded-xl shadow-xl',
            'border border-gray-200 dark:border-slate-700',
            'origin-[--radix-popover-content-transform-origin]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
            'z-[9999]'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Хедер */}
          <div className="p-3 border-b border-gray-100 dark:border-slate-800 shrink-0">
            <h4 className="font-semibold text-sm text-slate-900 dark:text-white">
              Колонки таблицы
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Скройте лишние показатели
            </p>
          </div>

          {/* Список метрик */}
          <div className="p-2 overflow-y-auto custom-scrollbar flex-1">
            {metrics.map((metric) => {
              const isVisible = !hiddenMetricIds.includes(metric.id);
              return (
                <button
                  key={metric.id}
                  onClick={() => onToggleMetric(metric.id)}
                  type="button"
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 rounded-lg',
                    'hover:bg-slate-50 dark:hover:bg-slate-800/50 transition text-left group',
                    'focus:outline-none focus:bg-slate-50 dark:focus:bg-slate-800/50'
                  )}
                >
                  <span
                    className={cn(
                      'text-sm truncate mr-2',
                      isVisible
                        ? 'text-slate-700 dark:text-slate-200 font-medium'
                        : 'text-slate-400 dark:text-slate-500'
                    )}
                  >
                    {metric.name}
                  </span>
                  <div
                    className={cn(
                      'w-4 h-4 rounded border flex items-center justify-center',
                      'transition-colors shrink-0',
                      isVisible
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'border-slate-300 dark:border-slate-600 group-hover:border-indigo-400'
                    )}
                  >
                    {isVisible && <Check size={10} strokeWidth={3} />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Футер со счётчиком */}
          <div className="px-3 py-2 border-t border-gray-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20 rounded-b-xl shrink-0">
            <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
              <span>Показано: {activeCount}</span>
              <span>из {metrics.length}</span>
            </div>
          </div>

          {/* Стрелка-индикатор */}
          <Popover.Arrow className="fill-white dark:fill-slate-900" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}