'use client';

import { Sidebar } from '@/widgets/sidebar';
import { MobileNav } from '@/widgets/mobile-nav';
import { ThemeProvider } from '@/app/providers';
import { Toaster } from 'sonner';
import { useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useShallow } from 'zustand/react/shallow';
import { toast } from '@/shared/ui/toast';
import { useStoreHydration } from './hydration'; // ← ИЗМЕНЕНО: импортируем из app/
import { useAppSettingsStore, selectEngineConfig } from '@/entities/app-settings';
import { useDatasetStore } from '@/entities/dataset';
import { duckdbManager } from '@/shared/lib/computation/lib/duckdb/manager';

/** Маршруты, требующие хотя бы один (не-справочный) датасет. */
const DATA_REQUIRED_PREFIXES = ['/dashboards', '/groups'];

export function ClientLayout({ children }: { children: React.ReactNode }) {
  // Глобальная гидрация Zustand-сторов
  const hydrated = useStoreHydration();

  // Гард данных: без датасетов дашборды/группы недоступны — уводим на
  // «Данные и Колонки». Покрывает и стартовый редирект (root → /dashboards),
  // и прямой заход по URL. Срабатывает только после гидрации, чтобы не
  // увести во время восстановления из IndexedDB.
  const router = useRouter();
  const pathname = usePathname();
  const datasets = useDatasetStore(s => s.datasets);
  const hasDataDataset = useMemo(
    () => Object.values(datasets).some(ds => ds.role !== 'reference'),
    [datasets]
  );
  useEffect(() => {
    if (!hydrated) return;
    const needsData = DATA_REQUIRED_PREFIXES.some(p => pathname?.startsWith(p));
    if (needsData && !hasDataDataset) router.replace('/setup');
  }, [hydrated, hasDataDataset, pathname, router]);

  // Настройки движка DuckDB (память ↔ время) → воркер. useShallow держит
  // ссылку стабильной (селектор возвращает новый объект), эффект срабатывает
  // только при реальном изменении значений.
  const engineConfig = useAppSettingsStore(useShallow(selectEngineConfig));
  useEffect(() => {
    void duckdbManager.setEngineConfig(engineConfig);
  }, [engineConfig]);

  useEffect(() => {
    const warned = sessionStorage.getItem('crypto_warning_shown');
    if (!warned) {
      toast.info(
        'Безопасность улучшена: ключи шифрования теперь хранятся только в рамках сессии. ' +
        'После закрытия вкладки потребуется повторный ввод паролей PostgreSQL.',
        { duration: 10000 }
      );
      sessionStorage.setItem('crypto_warning_shown', '1');
    }
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <div className="min-h-screen flex flex-col lg:flex-row">
        {/* 1. Мобильная навигация (скрыта на lg) */}
        <MobileNav />

        {/* 2. Десктопный сайдбар (скрыт на мобильных, фикс. позиция) */}
        <div className="hidden lg:block fixed inset-y-0 left-0 w-64 z-50">
          <Sidebar />
        </div>

        {/* 3. Основной контент.
            min-w-0: flex-элемент по умолчанию имеет min-width:auto (= ширина
            контента), из-за чего широкие таблицы/чарты раздували main и всю
            страницу. С min-w-0 main держит ширину вьюпорта, а внутренние
            overflow-x-auto (pivot-таблица, ScrollableChart) скроллятся в себе. */}
        <main className="flex-1 min-w-0 lg:ml-64 min-h-[calc(100vh-4rem)] lg:min-h-screen p-4 md:p-8">
          {children}
        </main>
      </div>
      <Toaster position="top-right" richColors theme="system" />
    </ThemeProvider>
  );
}