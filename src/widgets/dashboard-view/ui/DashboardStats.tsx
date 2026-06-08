'use client';
import type { DashboardComputationResult } from '@/entities/metric';

interface DashboardStatsProps {
  result: DashboardComputationResult | null;
}

export function DashboardStats({ result }: DashboardStatsProps) {
  if (!result) return null;

  return (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm">
      <div className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase mb-1">
        Статистика выборки
      </div>
      <div className="text-2xl font-mono text-slate-700 dark:text-slate-200">
        {result.totalRecords.toLocaleString()}
      </div>
      <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">
        записей обработано
      </div>
    </div>
  );
}