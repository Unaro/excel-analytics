'use client';
import { Database, FileSpreadsheet, TableProperties, Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { SetupStep } from '../model/types';

interface SetupStepperProps {
  step: SetupStep;
  hasActiveData: boolean;
}

/** Порядковый индекс шага для сравнения «пройден / текущий / впереди». */
const STEP_ORDER: Record<SetupStep, number> = {
  manager: 0,
  upload: 0,
  import: 1,
  columns: 2,
};

const STEPS: { index: number; label: string; icon: LucideIcon }[] = [
  { index: 0, label: '1. Источник', icon: Database },
  { index: 1, label: '2. Импорт', icon: FileSpreadsheet },
  { index: 2, label: '3. Колонки', icon: TableProperties },
];

export function SetupStepper({ step, hasActiveData }: SetupStepperProps) {
  const current = STEP_ORDER[step];

  return (
    <div className="relative">
      <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-200 dark:bg-slate-800 -z-10 -translate-y-1/2" />
      <div className="flex justify-between w-full max-w-lg mx-auto">
        {STEPS.map(({ index, label, icon: Icon }) => {
          const isCurrent = index === current;
          const isDone = index < current || (index === 0 && hasActiveData && current > 0);

          return (
            <div
              key={index}
              className={cn(
                'flex flex-col items-center gap-2 bg-gray-50 dark:bg-slate-950 px-2',
                isCurrent ? 'text-indigo-600' : 'text-slate-500'
              )}
            >
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors duration-300',
                  isCurrent
                    ? 'border-indigo-600 bg-white dark:bg-slate-900'
                    : isDone
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-gray-300 dark:border-slate-700 bg-gray-100 dark:bg-slate-800'
                )}
              >
                {isDone ? <Check size={20} /> : <Icon size={20} />}
              </div>
              <span className="text-xs font-bold uppercase">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
