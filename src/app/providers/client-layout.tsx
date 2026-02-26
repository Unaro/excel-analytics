'use client';

import { Sidebar } from '@/widgets/Sidebar';
import { MobileNav } from '@/widgets/MobileNav';
import { ThemeProvider } from '@/app/providers';
import { Toaster } from 'sonner';

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <div className="min-h-screen flex flex-col lg:flex-row">
        {/* 1. Мобильная навигация (скрыта на lg) */}
        <MobileNav />

        {/* 2. Десктопный сайдбар (скрыт на мобильных, фикс. позиция) */}
        <div className="hidden lg:block fixed inset-y-0 left-0 w-64 z-50">
          <Sidebar />
        </div>

        {/* 3. Основной контент */}
        <main className="flex-1 lg:ml-64 min-h-[calc(100vh-4rem)] lg:min-h-screen p-4 md:p-8">
          {children}
        </main>
      </div>
      <Toaster position="top-right" richColors theme="system" />
    </ThemeProvider>
  );
}
