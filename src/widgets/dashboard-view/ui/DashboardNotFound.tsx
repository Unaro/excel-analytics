'use client';

import Link from 'next/link';

export function DashboardNotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-950 gap-4">
      <div className="text-xl font-semibold text-gray-900 dark:text-white">
        Дашборд не найден
      </div>
      <Link href="/dashboards" className="text-indigo-600 hover:underline">
        Вернуться к списку
      </Link>
    </div>
  );
}