'use client';

import { useState, useEffect } from 'react';
import { Menu, LayoutDashboard } from 'lucide-react';
import { Sidebar } from './sidebar';
import { Button } from '@/components/ui/button';
import { usePathname } from 'next/navigation';

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Закрываем меню при смене роута (на всякий случай)
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Блокируем скролл body, когда меню открыто
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  return (
    <>
      {/* Мобильная Шапка (Видна только на мобильных: lg:hidden) */}
      <header className="lg:hidden h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between px-4 sticky top-0 z-40">
        <div className="flex items-center gap-2 font-bold text-lg text-slate-900 dark:text-white">
          <div className="w-7 h-7 bg-indigo-600 rounded-md flex items-center justify-center text-white">
            <LayoutDashboard size={16} />
          </div>
          <span>UrbanAnalytics</span>
        </div>
        
        <Button variant="ghost" size="icon" onClick={() => setIsOpen(true)}>
          <Menu size={24} />
        </Button>
      </header>

      {/* Оверлей и Сайдбар */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Затемнение фона */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Выезжающая панель */}
          <div className="fixed inset-y-0 left-0 w-64 animate-in slide-in-from-left duration-300 shadow-2xl">
            <Sidebar onClose={() => setIsOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}