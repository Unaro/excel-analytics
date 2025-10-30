'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Settings as SettingsIcon,
  Layers,
  Database,
  Trash2,
  LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
  color: 'blue' | 'green' | 'purple' | 'red';
}

const navItems: NavItem[] = [
  {
    href: '/settings/main',
    label: 'Основные',
    icon: SettingsIcon,
    description: 'Типы данных и поля',
    color: 'blue',
  },
  {
    href: '/settings/hierarchy',
    label: 'Иерархия',
    icon: Layers,
    description: 'Настройка иерархии',
    color: 'green',
  },
  {
    href: '/settings/danger',
    label: 'Опасная зона',
    icon: Trash2,
    description: 'Удаление данных',
    color: 'red',
  },
];

const colorClasses: Record<string, { text: string; bg: string; border: string }> = {
  blue: {
    text: 'text-blue-600',
    bg: 'bg-blue-50 hover:bg-blue-100',
    border: 'border-blue-500',
  },
  green: {
    text: 'text-green-600',
    bg: 'bg-green-50 hover:bg-green-100',
    border: 'border-green-500',
  },
  purple: {
    text: 'text-purple-600',
    bg: 'bg-purple-50 hover:bg-purple-100',
    border: 'border-purple-500',
  },
  red: {
    text: 'text-red-600',
    bg: 'bg-red-50 hover:bg-red-100',
    border: 'border-red-500',
  },
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Настройки</h1>
            <p className="mt-2 text-sm text-gray-600">
              Управление типами данных, фильтрами и опасными операциями
            </p>
          </div>
        </div>

        {/* Горизонтальная навигация */}
        <div className="border-t border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex overflow-x-auto space-x-8" aria-label="Tabs">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                const colors = colorClasses[item.color];

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-all',
                      isActive
                        ? `border-${item.color}-500 ${colors.text}`
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    )}
                  >
                    <Icon className="w-4 h-4 inline mr-2" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </div>
    </div>
  );
}
