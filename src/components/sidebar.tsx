'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileSpreadsheet,
  Users,
  Settings,
  Upload,
  Menu,
  X,
  ChevronRight,
  Database,
  BarChart3,
  Layers,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badge?: string;
  subItems?: NavItem[];
}

export default function Sidebar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Закрываем мобильное меню при изменении маршрута
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Закрываем меню при клике вне его на мобильных
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const sidebar = document.getElementById('mobile-sidebar');
      const menuButton = document.getElementById('mobile-menu-button');
      
      if (
        isMobileMenuOpen &&
        sidebar &&
        menuButton &&
        !sidebar.contains(event.target as Node) &&
        !menuButton.contains(event.target as Node)
      ) {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobileMenuOpen]);

  const navItems: NavItem[] = [
    {
      name: 'Главная',
      href: '/',
      icon: Upload,
    },
    {
      name: 'Данные',
      href: '/data',
      icon: Database,
    },
    {
      name: 'Дашборд',
      href: '/dashboard',
      icon: LayoutDashboard,
      subItems: [
        { name: 'Обзор', href: '/dashboard/overview', icon: BarChart3 },
        { name: 'Сравнение', href: '/dashboard/comparison', icon: Layers },
        { name: 'SQL Builder', href: '/dashboard/sql', icon: FileSpreadsheet },
        { name: 'Кастомный', href: '/dashboard/builder', icon: Settings },
      ],
    },
    {
      name: 'Группы показателей',
      href: '/groups',
      icon: Users,
    },
    {
      name: 'Настройки',
      href: '/settings',
      icon: Settings,
      subItems: [
        { name: 'Основные', href: '/settings/main', icon: Settings,},
        { name: 'Иерархия', href: '/settings/hierarchy', icon: Layers,}
      ]
    },
  ];

  const toggleExpanded = (itemName: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemName)) {
        newSet.delete(itemName);
      } else {
        newSet.add(itemName);
      }
      return newSet;
    });
  };

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === href;
    }
    return pathname?.startsWith(href);
  };

  const renderNavItem = (item: NavItem, depth = 0) => {
    const active = isActive(item.href);
    const hasSubItems = item.subItems && item.subItems.length > 0;
    const isExpanded = expandedItems.has(item.name);
    const Icon = item.icon;

    return (
      <div key={item.href}>
        <div className="relative">
          <Link
            href={item.href}
            onClick={(e) => {
              if (hasSubItems && !isCollapsed) {
                e.preventDefault();
                toggleExpanded(item.name);
              }
            }}
            className={`
              flex items-center gap-3 px-4 py-3 rounded-lg transition-all group
              ${active 
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg' 
                : 'text-gray-700 hover:bg-gray-100'
              }
              ${depth > 0 ? 'ml-4' : ''}
              ${isCollapsed ? 'justify-center' : ''}
            `}
            title={isCollapsed ? item.name : undefined}
          >
            <Icon 
              size={20} 
              className={active ? 'text-white' : 'text-gray-500 group-hover:text-blue-600'} 
            />
            {!isCollapsed && (
              <>
                <span className="flex-1 font-medium">{item.name}</span>
                {item.badge && (
                  <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                    {item.badge}
                  </span>
                )}
                {hasSubItems && (
                  <ChevronRight 
                    size={16}
                    className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  />
                )}
              </>
            )}
          </Link>
        </div>

        {/* Подменю */}
        {hasSubItems && isExpanded && !isCollapsed && (
          <div className="mt-1 space-y-1 ml-2">
            {item.subItems!.map((subItem) => renderNavItem(subItem, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Мобильная кнопка меню */}
      <button
        id="mobile-menu-button"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="fixed top-4 left-4 z-50 lg:hidden p-2 bg-white rounded-lg shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors"
      >
        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Overlay для мобильных */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar для десктопа */}
      <aside
        className={`
          hidden lg:flex flex-col
          ${isCollapsed ? 'w-20' : 'w-64'}
          h-screen bg-white border-r border-gray-200 sticky top-0 transition-all duration-300
        `}
      >
        {/* Заголовок */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {!isCollapsed && (
              <div>
                <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Analytics
                </h2>
                <p className="text-xs text-gray-500 mt-1">Платформа анализа</p>
              </div>
            )}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title={isCollapsed ? 'Развернуть' : 'Свернуть'}
            >
              <ChevronRight 
                size={20} 
                className={`transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
              />
            </button>
          </div>
        </div>

        {/* Навигация */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {navItems.map((item) => renderNavItem(item))}
        </nav>

        {/* Футер */}
        <div className="p-4 border-t border-gray-200">
          {!isCollapsed && (
            <div className="text-xs text-gray-500 text-center">
              <p>© 2025 Analytics Platform</p>
              <p className="mt-1">Версия 1.0.0</p>
            </div>
          )}
        </div>
      </aside>

      {/* Sidebar для мобильных */}
      <aside
        id="mobile-sidebar"
        className={`
          fixed top-0 left-0 z-40 h-screen w-72 bg-white border-r border-gray-200 transform transition-transform duration-300 lg:hidden
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Заголовок мобильный */}
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Analytics
          </h2>
          <p className="text-xs text-gray-500 mt-1">Платформа анализа</p>
        </div>

        {/* Навигация мобильная */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-2 h-[calc(100vh-180px)]">
          {navItems.map((item) => renderNavItem(item))}
        </nav>

        {/* Футер мобильный */}
        <div className="p-4 border-t border-gray-200">
          <div className="text-xs text-gray-500 text-center">
            <p>© 2025 Analytics Platform</p>
            <p className="mt-1">Версия 29102025</p>
          </div>
        </div>
      </aside>

      {/* Spacer для десктопа чтобы контент не перекрывался */}
      <div className={`hidden lg:block ${isCollapsed ? 'w-20' : 'w-64'} flex-shrink-0`} />
    </>
  );
}
