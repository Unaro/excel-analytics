'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {Settings as SettingsIcon, Layers } from 'lucide-react';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  const tabs = [
    { 
      href: '/settings/main', 
      label: 'Главная', 
      icon: SettingsIcon,
      color: 'blue'
    },
    { 
      href: '/settings/hierarchy', 
      label: 'Иерархия', 
      icon: Layers,
      color: 'green'
    }
  ];

  return (
    <div>
      {/* Табы навигации */}
      <div className="bg-white rounded-xl shadow-lg mb-6 overflow-hidden">
        <div className="flex border-b border-gray-200">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = pathname === tab.href;
            
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`
                  flex-1 px-6 py-4 text-center font-semibold transition-all flex items-center justify-center gap-2
                  ${isActive 
                    ? `bg-${tab.color}-600 text-white border-b-4 border-${tab.color}-700` 
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                  }
                `}
              >
                <Icon size={20} />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Контент страницы */}
      {children}
    </div>
  );
}
