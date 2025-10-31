// src/app/dashboard/layout.tsx (вставить в верхнюю часть layout)
'use client';

import { DashboardNav, defaultDashboardNavItems } from '@/components/dashboard/DashboardNav';
import { ReactNode } from 'react';

// Если в layout уже есть шапка/контейнеры — оставляем, только добавляем DashboardNav
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Верхняя навигация дашборда */}
      <DashboardNav
        items={defaultDashboardNavItems}
        // rightSlot можно использовать для глобальных фильтров/кнопок:
        // rightSlot={<GlobalFilters />}
      />

      {/* Контент */}
      <main className="flex-1">
        <div className="max-w-screen-2xl mx-auto px-4 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
