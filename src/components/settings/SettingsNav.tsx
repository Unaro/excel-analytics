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
import React from 'react';

interface SettingsNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
  color: 'blue' | 'green' | 'purple' | 'red' | 'orange';
}

const colorClasses = {
  blue: 'text-blue-600 bg-blue-50 hover:bg-blue-100',
  green: 'text-green-600 bg-green-50 hover:bg-green-100',
  purple: 'text-purple-600 bg-purple-50 hover:bg-purple-100',
  red: 'text-red-600 bg-red-50 hover:bg-red-100',
  orange: 'text-orange-600 bg-orange-50 hover:bg-orange-100',
};

const navItems: SettingsNavItem[] = [
  {
    href: '/settings/main',
    label: 'Основные',
    icon: SettingsIcon,
    description: 'Типы данных и очистка',
    color: 'blue',
  },
  {
    href: '/settings/hierarchy',
    label: 'Иерархия',
    icon: Layers,
    description: 'Настройка иерархии фильтрации',
    color: 'green',
  },
  {
    href: '/settings/fields',
    label: 'Поля',
    icon: Database,
    description: 'Классификация полей',
    color: 'purple',
  },
  {
    href: '/settings/danger',
    label: 'Опасная зона',
    icon: Trash2,
    description: 'Удаление данных',
    color: 'red',
  },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'p-4 rounded-lg border-2 transition-all',
              isActive
                ? `border-${item.color}-500 ${colorClasses[item.color]}`
                : 'border-gray-200 bg-white hover:border-gray-300',
              'flex items-start gap-3 group'
            )}
          >
            <Icon
              className={cn(
                'w-6 h-6 mt-1 flex-shrink-0 transition-transform group-hover:scale-110',
                isActive ? `text-${item.color}-600` : 'text-gray-400'
              )}
            />
            <div>
              <h3 className={cn('font-semibold', isActive ? `text-${item.color}-900` : 'text-gray-900')}>
                {item.label}
              </h3>
              <p className="text-sm text-gray-600">{item.description}</p>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}

export function SettingsNavHorizontal() {
  const pathname = usePathname();

  return (
    <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-2 px-4 py-3 border-b-2 whitespace-nowrap transition-colors',
              isActive
                ? `border-${item.color}-500 text-${item.color}-600 bg-${item.color}-50`
                : 'border-transparent text-gray-600 hover:text-gray-900'
            )}
          >
            {React.createElement(item.icon, { className: 'w-4 h-4' })}
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
