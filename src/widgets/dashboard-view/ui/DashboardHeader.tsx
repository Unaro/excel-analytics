'use client';

import Link from 'next/link';
import { ArrowLeft, Edit, RotateCw, Loader2 } from 'lucide-react';
import { AddKPIDialog } from '@/features/add-kpi-widget';
import type { Dashboard } from '@/entities/dashboard';
import { DatasetStatusBadge, type DatasetStatus } from './DatasetStatusBadge';

export interface ComputationStatus {
  isComputing: boolean;
  computedAt?: number;
  onRecalculate: () => void;
}

interface DashboardHeaderProps {
  dashboard: Dashboard;
  datasetStatus: DatasetStatus;
  computationStatus: ComputationStatus;
}

/**
 * Хедер страницы просмотра дашборда.
 *
 * Пропсы сгруппированы по доменам:
 *  - `dashboard` — данные дашборда (название, описание)
 *  - `datasetStatus` — состояние привязанного датасета (PG/Excel, online/offline, refresh)
 *  - `computationStatus` — состояние вычислений (isComputing, computedAt, recalculate)
 *
 * Раньше было 11 разрозненных пропсов — сейчас 3 логических объекта.
 */
export function DashboardHeader({
  dashboard,
  datasetStatus,
  computationStatus,
}: DashboardHeaderProps) {
  const { isComputing, computedAt, onRecalculate } = computationStatus;

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
        <div className="text-xs font-mono text-gray-400 dark:text-slate-500 mr-1">
          {isComputing ? (
            <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 animate-pulse">
              <Loader2 size={12} className="animate-spin" /> Вычисление...
            </span>
          ) : computedAt ? (
            <span>Обновлено: {new Date(computedAt).toLocaleTimeString()}</span>
          ) : null}
        </div>

        <DatasetStatusBadge status={datasetStatus} />

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