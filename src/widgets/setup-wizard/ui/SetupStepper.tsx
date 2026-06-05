'use client';
import { Database, TableProperties, Check } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { SetupStep } from '../model/types';

interface SetupStepperProps {
  step: SetupStep;
  hasActiveData: boolean;
}

export function SetupStepper({ step, hasActiveData }: SetupStepperProps) {
  return (
    <div className="relative">
      <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-200 dark:bg-slate-800 -z-10 -translate-y-1/2" />
      <div className="flex justify-between w-full max-w-md mx-auto">
        {/* Шаг 1: Источники */}
        <div
          className={cn(
            'flex flex-col items-center gap-2 bg-gray-50 dark:bg-slate-950 px-2',
            step === 'upload' || step === 'manager'
              ? 'text-indigo-600'
              : 'text-slate-500'
          )}
        >
          <div
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors duration-300',
              step === 'upload' || step === 'manager'
                ? 'border-indigo-600 bg-white dark:bg-slate-900'
                : hasActiveData
                ? 'border-emerald-500 bg-emerald-500 text-white'
                : 'border-gray-300 dark:border-slate-700 bg-gray-100 dark:bg-slate-800'
            )}
          >
            {hasActiveData && step === 'columns' ? (
              <Check size={20} />
            ) : (
              <Database size={20} />
            )}
          </div>
          <span className="text-xs font-bold uppercase">1. Источники</span>
        </div>

        {/* Шаг 2: Колонки */}
        <div
          className={cn(
            'flex flex-col items-center gap-2 bg-gray-50 dark:bg-slate-950 px-2',
            step === 'columns' ? 'text-indigo-600' : 'text-slate-500'
          )}
        >
          <div
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors duration-300',
              step === 'columns'
                ? 'border-indigo-600 bg-white dark:bg-slate-900'
                : 'border-gray-300 dark:border-slate-700 bg-gray-100 dark:bg-slate-800'
            )}
          >
            <TableProperties size={20} />
          </div>
          <span className="text-xs font-bold uppercase">2. Колонки</span>
        </div>
      </div>
    </div>
  );
}