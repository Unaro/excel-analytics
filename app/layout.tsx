import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/layout/sidebar';
import { MobileNav } from '@/components/layout/mobile-nav'; // <--- Импорт
import { ThemeProvider } from '@/components/providers';
import { Toaster } from 'sonner';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export const metadata: Metadata = {
  title: 'UrbanAnalytics',
  description: 'Градостроительный анализ данных',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={`${inter.className} bg-gray-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 transition-colors duration-300`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div className="min-h-screen flex flex-col lg:flex-row">
            
            {/* 1. Мобильная навигация (скрыта на lg) */}
            <MobileNav />

            {/* 2. Десктопный сайдбар (скрыт на мобильных, фикс. позиция) */}
            <div className="hidden lg:block fixed inset-y-0 left-0 w-64 z-50">
               <Sidebar />
            </div>

            {/* 3. Основной контент */}
            {/* На мобильных ml-0, на десктопе ml-64 */}
            <main className="flex-1 lg:ml-64 min-h-[calc(100vh-4rem)] lg:min-h-screen p-4 md:p-8">
              {children}
            </main>
            
          </div>
          <Toaster position="top-right" richColors theme="system" />
        </ThemeProvider>
      </body>
    </html>
  );
}