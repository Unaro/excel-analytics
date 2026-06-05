'use client';

import { Database, FileSpreadsheet, RefreshCw } from 'lucide-react';
import type { DatasetEntry } from '@/entities/dataset';

export interface DatasetStatus {
  dataset: DatasetEntry | null;
  isPgSource: boolean;
  pgStatus?: string;
  isSyncing: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
}

/**
 * Приватный бейдж статуса датасета для DashboardHeader.
 *
 * Вынесен из DashboardHeader, чтобы:
 *  - Уменьшить количество пропсов хедера
 *  - Изолировать логику рендера PG/File статуса
 *  - Сделать возможным переиспользование (например, в DatasetSwitcher, если потребуется)
 */
export function DatasetStatusBadge({ status }: { status: DatasetStatus }) {
  const { dataset, isPgSource, pgStatus, isSyncing, isRefreshing, onRefresh } = status;

  if (!dataset) return null;

  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
      {isPgSource ? (
        <>
          <Database
            size={14}
            className={`shrink-0 ${pgStatus === 'offline' ? 'text-red-500' : 'text-indigo-600 dark:text-indigo-400'}`}
          />
          <span
            className={`w-2 h-2 rounded-full ${
              pgStatus === 'online'
                ? 'bg-emerald-500'
                : pgStatus === 'offline'
                ? 'bg-red-500 animate-pulse'
                : 'bg-amber-400 animate-ping'
            }`}
          />
          <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wide">
            {dataset.rows?.length ?? 0} строк
          </span>
        </>
      ) : (
        <>
          <FileSpreadsheet size={14} className="text-indigo-600 dark:text-indigo-400" />
          <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wide">
            Excel
          </span>
        </>
      )}
      {isPgSource && (
        <button
          onClick={onRefresh}
          disabled={isRefreshing || isSyncing}
          className="ml-1 p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          title="Обновить данные из PostgreSQL"
        >
          <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
        </button>
      )}
    </div>
  );
}