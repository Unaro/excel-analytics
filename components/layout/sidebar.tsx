'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation'; // Добавил useRouter
import { 
  LayoutDashboard, Database, Calculator, Layers, GitMerge, 
  FileSpreadsheet, LucideIcon, X, 
  Settings,
  Trash2, // Иконка удаления
  RefreshCw // Или иконка обновления
} from 'lucide-react';
import { useExcelDataStore } from '@/lib/stores/excel-data-store';
import { useStoreHydration } from '@/lib/hooks/use-store-hydration';
import { ThemeToggle } from './theme-toggle';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { memo } from 'react';
import { toast } from 'sonner'; // Для уведомлений

type MenuItemLink = { type: 'link'; href: string; label: string; icon: LucideIcon; };
type MenuItemDivider = { type: 'divider'; };
type MenuItem = MenuItemLink | MenuItemDivider;

interface SidebarProps {
  className?: string;
  onClose?: () => void;
}

const SidebarComponent = ({ className, onClose }: SidebarProps) => {
  const pathname = usePathname();
  const router = useRouter(); // Роутер для редиректа
  const hydrated = useStoreHydration();
  
  // Достаем fileName и экшен удаления
  const fileName = useExcelDataStore(s => s.metadata?.fileName);
  const clearDataset = useExcelDataStore(s => s.clearData);

  const menuItems: MenuItem[] = [
    { type: 'link', href: '/dashboards', label: 'Дашборды', icon: LayoutDashboard },
    { type: 'divider' },
    { type: 'link', href: '/groups', label: 'Группы показателей', icon: Layers },
    { type: 'link', href: '/metrics', label: 'Метрики (Правила)', icon: Calculator },
    { type: 'divider' },
    { type: 'link', href: '/setup', label: 'Данные и Колонки', icon: Database },
    { type: 'link', href: '/hierarchy', label: 'Иерархия', icon: GitMerge },
    { type: 'divider' },
    { type: 'link', href: '/settings', label: 'Настройки', icon: Settings },
  ];

  // Хендлер хот-свапа
  const handleRemoveDataset = () => {
    // Простой confirm (можно заменить на AlertDialog из shadcn для красоты)
    const confirmed = window.confirm(
      'Вы уверены? Это удалит ТЕКУЩИЕ данные, но сохранит все настройки, метрики и дашборды.\n\nЗагрузите новый файл с такой же структурой колонок, чтобы продолжить работу.'
    );

    if (confirmed) {
      clearDataset(); // Очищаем только Excel Store
      toast.success('Датасет отключен. Загрузите новые данные.');
      router.push('/setup'); // Редирект на загрузку
      if (onClose) onClose();
    }
  };

  return (
    <div className={cn(
      "flex flex-col h-full bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 transition-colors duration-300",
      className
    )}>
      {/* Логотип */} 
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

      {/* Статус файла (Hot Swap Zone) */}
      <div className="px-4 py-4 bg-gray-50/50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800 backdrop-blur-sm">
        <div className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">
          Активный dataset
        </div>
        {hydrated && fileName ? (
          <div className="group relative flex items-center justify-between gap-2 text-sm bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded-lg border border-emerald-100 dark:border-emerald-900/50 transition-colors">
            
            {/* Имя файла */}
            <div className="flex items-center gap-2 truncate overflow-hidden">
              <FileSpreadsheet size={16} className="shrink-0 text-emerald-700 dark:text-emerald-400 opacity-70" />
              <span className="truncate font-medium text-emerald-900 dark:text-emerald-300" title={fileName}>
                {fileName}
              </span>
            </div>

            {/* Кнопка Хот-Свапа */}
            <button 
              onClick={handleRemoveDataset}
              className="p-1.5 rounded-md hover:bg-white dark:hover:bg-emerald-900 text-emerald-600/70 hover:text-red-500 dark:text-emerald-400 dark:hover:text-red-400 transition-all shadow-sm opacity-100 lg:opacity-0 group-hover:opacity-100"
              title="Заменить файл (Hot Swap)"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ) : (
          <Link 
            href="/setup" 
            onClick={onClose}
            className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 p-2 rounded-lg border border-dashed border-indigo-200 dark:border-indigo-800 transition-colors"
          >
            <Database size={16} />
            <span className="font-medium">Загрузить файл</span>
          </Link>
        )}
      </div>

      {/* Меню */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
        {menuItems.map((item, idx) => {
          if (item.type === 'divider') {
            return <div key={`div-${idx}`} className="h-px bg-gray-100 dark:bg-slate-800 my-4 mx-2" />;
          }

          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);

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

      {/* Футер */}
      <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50/30 dark:bg-slate-900/50">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-slate-400">Тема интерфейса</span>
        </div>
        <ThemeToggle />
      </div>
    </div>
  );
}

export const Sidebar = memo(SidebarComponent);