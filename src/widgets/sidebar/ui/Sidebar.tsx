'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Database, Calculator, Layers, GitMerge,
  LucideIcon, X,
  Settings,
  Loader2,
  AlertCircle,
  BookMarked,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import DatasetSwitcher from '@/widgets/dataset-switcher';
import { ThemeToggle } from '@/shared/ui/theme-toggle';
import { useEngineStatus } from '@/entities/dataset';

type MenuItemLink = { type: 'link'; href: string; label: string; icon: LucideIcon; disabled?: boolean };
type MenuItemDivider = { type: 'divider'; };
type MenuItem = MenuItemLink | MenuItemDivider;

interface SidebarProps {
  className?: string;
  onClose?: () => void;
}

const SidebarComponent = ({ className, onClose }: SidebarProps) => {
  const pathname = usePathname();
  const isDashboardPage = /^\/dashboards\/[^/]+$/.test(pathname || '');
  // Страницы конкретной группы (/groups/{id} и /groups/{id}/edit, кроме
  // /groups/new): активный датасет там диктуется привязкой группы —
  // ручное переключение сломало бы вычисления и привязки колонок
  const isGroupPage = /^\/groups\/(?!new(?:$|\/))[^/]+/.test(pathname || '');
  const isDatasetLocked = isDashboardPage || isGroupPage;

  const { status } = useEngineStatus();

  const isEngineBroken = status === 'disconnected' || status === 'error' || status === 'no-data';


  const menuItems: MenuItem[] = [
    { 
      type: 'link', 
      href: '/dashboards', 
      label: 'Дашборды', 
      icon: LayoutDashboard,
      disabled: isEngineBroken,
    },
    { type: 'divider' },
    { 
      type: 'link', 
      href: '/groups', 
      label: 'Группы показателей', 
      icon: Layers,
      disabled: isEngineBroken,
    },
    { type: 'link', href: '/metrics', label: 'Метрики (Правила)', icon: Calculator },
    { type: 'divider' },
    { type: 'link', href: '/setup', label: 'Данные и Колонки', icon: Database },
    { type: 'link', href: '/hierarchy', label: 'Иерархия', icon: GitMerge },
    { type: 'link', href: '/references', label: 'Справочники', icon: BookMarked },
    { type: 'divider' },
    { type: 'link', href: '/settings', label: 'Настройки', icon: Settings },
  ];

  return (
    <div className={cn(
      "flex flex-col h-full bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 transition-colors duration-300",
      className
    )}>
      <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center">
        <div className="flex items-center gap-3 font-bold text-xl text-gray-900 dark:text-white">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
            <LayoutDashboard size={18} />
          </div>
          <span className="tracking-tight">Urban<span className="text-indigo-600 dark:text-indigo-400">Analytics</span></span>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="lg:hidden">
            <X size={20} />
          </Button>
        )}
      </div>

      <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 bg-gray-50/30 dark:bg-slate-900/30">
        <DatasetSwitcher isDisabled={isDatasetLocked} />
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
        {menuItems.map((item, idx) => {
          if (item.type === 'divider') {
            return <div key={`div-${idx}`} className="h-px bg-gray-100 dark:bg-slate-800 my-4 mx-2" />;
          }
          const Icon = item.icon;
          const isActive = pathname?.startsWith(item.href);
          const isDisabled = item.disabled;
          
          if (isDisabled) {
            return (
              <div
                key={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50"
                title="Требуется загрузить данные"
              >
                <Icon size={18} className="opacity-50" />
                {item.label}
              </div>
            );
          }
          
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              <Icon size={18} className={isActive ? 'text-indigo-600 dark:text-indigo-400' : 'opacity-70'} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50/30 dark:bg-slate-900/50">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-slate-400">Тема интерфейса</span>
        </div>
        {status !== 'ready' && status !== 'no-data' && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2 text-xs">
              {status === 'disconnected' && (
                <>
                  <AlertCircle size={14} className="text-amber-600 dark:text-amber-400" />
                  <span className="text-amber-700 dark:text-amber-300 font-medium">
                    Движок отключён
                  </span>
                </>
              )}
              {status === 'error' && (
                <>
                  <AlertCircle size={14} className="text-rose-600 dark:text-rose-400" />
                  <span className="text-rose-700 dark:text-rose-300 font-medium">
                    Файл утерян
                  </span>
                </>
              )}
              {status === 'loading' && (
                <>
                  <Loader2 size={14} className="animate-spin text-indigo-500" />
                  <span className="text-indigo-700 dark:text-indigo-300 font-medium">
                    Восстановление...
                  </span>
                </>
              )}
            </div>
          </div>
        )}
        <ThemeToggle />
      </div>
    </div>
  );
}

export const Sidebar = SidebarComponent;