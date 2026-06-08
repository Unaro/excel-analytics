'use client';

import Link from 'next/link';
import { AlertCircle } from 'lucide-react';

interface DatasetUnavailableProps {
  dashboardName: string;
}

export function DatasetUnavailable({ dashboardName }: DatasetUnavailableProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950 p-6">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-dashed border-amber-300 dark:border-amber-700 rounded-2xl p-8 text-center shadow-sm">
        <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Датасет недоступен
        </h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
          Дашборд <strong>&quot;{dashboardName}&quot;</strong> привязан к датасету,
          который был удален или не загружен.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/setup"
            className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Загрузить датасет
          </Link>
          <Link
            href="/dashboards"
            className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-sm"
          >
            Вернуться к списку
          </Link>
        </div>
      </div>
    </div>
  );
}