'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sparkles,
  BarChart3,
  TrendingUp,
  Settings as SettingsIcon,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { dataStore } from '@/lib/data-store';

interface Tab {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [hasData, setHasData] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    setIsLoading(true);
    try {
      const dataExists = dataStore.hasData();
      setHasData(dataExists);
    } catch (error) {
      console.error('Ошибка проверки данных:', error);
      setHasData(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const tabs: Tab[] = [
    {
      href: '/dashboard/overview',
      label: 'Обзор',
      icon: Sparkles,
      description: 'Сводка по всем группам',
    },
    {
      href: '/dashboard/comparison',
      label: 'Сравнение',
      icon: BarChart3,
      description: 'Сравнение групп',
    },
    {
      href: '/dashboard/sql',
      label: 'SQL Builder',
      icon: TrendingUp,
      description: 'SQL запросы',
    },
    {
      href: '/dashboard/builder',
      label: 'Кастомный',
      icon: SettingsIcon,
      description: 'Создавайте дашборды',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Верхняя панель с навигацией */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Главная навигация */}
          <div className="flex items-center justify-between h-16 gap-4">
            <Link
              href="/data"
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Вернуться</span>
            </Link>

            <h1 className="text-xl font-bold text-gray-900">Дашборды</h1>

            <div className="flex-1" />
          </div>

          {/* Статус данных */}
          {!isLoading && !hasData && (
            <div className="flex items-center gap-2 pb-4 px-4 py-2 bg-yellow-50 rounded-lg border border-yellow-200">
              <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
              <p className="text-sm text-yellow-800">
                Загрузите Excel файл, чтобы использовать дашборды
              </p>
              <Link
                href="/"
                className="ml-auto text-sm font-medium text-yellow-700 hover:text-yellow-900 underline"
              >
                Загрузить
              </Link>
            </div>
          )}

          {/* Вкладки */}
          <div className="flex gap-2 overflow-x-auto pb-0 -mb-px">
            {tabs.map((tab) => {
              const isActive = pathname === tab.href;
              const Icon = tab.icon;

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`flex items-center gap-2 px-4 py-3 whitespace-nowrap text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  } ${!hasData ? 'pointer-events-none opacity-50' : ''}`}
                  title={!hasData ? 'Загрузите данные' : tab.description}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Главное содержимое */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
