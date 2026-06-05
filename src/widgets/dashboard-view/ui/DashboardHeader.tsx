'use client';
import Link from 'next/link';
import {
  ArrowLeft, Edit, RotateCw, RefreshCw, Loader2,
  Database, FileSpreadsheet
} from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { AddKPIDialog } from '@/features/AddKpiWidget';
import type { Dashboard } from '@/entities/dashboard';
import type { DatasetEntry } from '@/entities/dataset';

interface DashboardHeaderProps {
  dashboard: Dashboard;
  boundDataset: DatasetEntry | null;
  isComputing: boolean;
  isSyncing: boolean;
  isPgSource: boolean;
  pgStatus?: string;
  refreshingDataset: boolean;
  computedAt?: number;
  onRecalculate: () => void;
  onRefreshDataset: () => void;
}

export function DashboardHeader({
  dashboard,
  boundDataset,
  isComputing,
  isSyncing,
  isPgSource,
  pgStatus,
  refreshingDataset,
  computedAt,
  onRecalculate,
  onRefreshDataset,
}: DashboardHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboards"
          className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-500 dark:text-slate-400 transition"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {dashboard.name}
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {dashboard.description || 'Аналитическая таблица'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {/* Статус вычисления */}
        <div className="text-xs font-mono text-gray-400 dark:text-slate-500 mr-1">
          {isComputing ? (
            <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 animate-pulse">
              <Loader2 size={12} className="animate-spin" /> Вычисление...
            </span>
          ) : computedAt ? (
            <span>Обновлено: {new Date(computedAt).toLocaleTimeString()}</span>
          ) : null}
        </div>

        {/* Статус датасета */}
        {boundDataset && (
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
                  {boundDataset.rows?.length ?? 0} строк
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
                onClick={onRefreshDataset}
                disabled={refreshingDataset || isSyncing}
                className="ml-1 p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                title="Обновить данные из PostgreSQL"
              >
                <RefreshCw size={13} className={refreshingDataset ? 'animate-spin' : ''} />
              </button>
            )}
          </div>
        )}

        <AddKPIDialog dashboardId={dashboard.id} />

        <button
          onClick={onRecalculate}
          disabled={isComputing}
          className="p-2 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-md transition disabled:opacity-50"
          title="Пересчитать показатели"
        >
          <RotateCw size={18} className={isComputing ? 'animate-spin' : ''} />
        </button>

        <Link
          href={`/dashboards/${dashboard.id}/edit`}
          className="flex items-center gap-2 bg-slate-900 dark:bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-slate-800 dark:hover:bg-indigo-700 transition text-sm font-medium shadow-sm"
        >
          <Edit size={16} />
        </Link>
      </div>
    </div>
  );
}