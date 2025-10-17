'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Table, Layers, BarChart3, Settings } from 'lucide-react';

const menuItems = [
  { href: '/', label: 'Главная', icon: Home },
  { href: '/data', label: 'Данные', icon: Table },
  { href: '/groups', label: 'Группы показателей', icon: Layers },
  { href: '/dashboard', label: 'Дашборд', icon: BarChart3 },
  { href: '/statistics', label: 'Статистика', icon: BarChart3 },
  { href: '/settings', label: 'Настройки', icon: Settings },

];


export default function Sidebar() {
  const pathname = usePathname();
  
  return (
    <aside className="w-64 bg-gray-900 text-white h-screen fixed left-0 top-0 overflow-y-auto">
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-8">Excel Analytics</h1>
        <nav>
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-gray-800'
                    }`}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </aside>
  );
}
