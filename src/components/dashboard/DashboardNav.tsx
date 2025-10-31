// src/components/dashboard/DashboardNav.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { BarChart3, LayoutTemplate, GitCompareArrows, Layers, Table, Code } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon?: ReactNode;
  badgeCount?: number;
  exact?: boolean; // если нужен точный матч пути
}

interface DashboardNavProps {
  items: NavItem[];
  rightSlot?: ReactNode; // место для глобальных фильтров/кнопок
  className?: string;
}

export function DashboardNav({ items, rightSlot, className = '' }: DashboardNavProps) {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <nav className={`w-full border-b border-gray-200 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60 ${className}`}>
      <div className="max-w-screen-2xl mx-auto px-4">
        <div className="flex items-center justify-between h-12">
          <ul className="flex items-center gap-1 overflow-x-auto">
            {items.map((item) => {
              const active = isActive(item.href, item.exact);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors
                      ${active 
                        ? 'bg-blue-600 text-white' 
                        : 'text-gray-700 hover:bg-gray-100'
                      }`}
                  >
                    {item.icon}
                    <span className="whitespace-nowrap">{item.label}</span>
                    {typeof item.badgeCount === 'number' && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${active ? 'bg-white/20' : 'bg-gray-200 text-gray-700'}`}>
                        {item.badgeCount}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          {rightSlot && (
            <div className="ml-3 flex items-center">{rightSlot}</div>
          )}
        </div>
      </div>
    </nav>
  );
}

// Вспомогательная конфигурация по умолчанию (можно импортировать)
export const defaultDashboardNavItems: NavItem[] = [
  { href: '/dashboard/overview', label: 'Обзор', icon: <BarChart3 className="w-4 h-4" />, exact: false },
  { href: '/dashboard/builder', label: 'Конструктор', icon: <LayoutTemplate className="w-4 h-4" /> },
  { href: '/dashboard/comparison', label: 'Сравнение', icon: <GitCompareArrows className="w-4 h-4" /> },
  { href: '/dashboard/sql', label: 'SQL', icon: <Code className="w-4 h-4" /> },
];
