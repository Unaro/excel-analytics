'use client';
import { memo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Layers, Edit, Home, ChevronRight } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import { IndicatorGroup, HierarchyFilterValue } from '@/shared/lib/validators';

interface GroupPageHeaderProps {
  group: IndicatorGroup;
  groupId: string;
  currentPath: HierarchyFilterValue[];
  onResetAll: () => void;
  onResetToLevel: (levelIndex: number) => void;
}

export const GroupPageHeader = memo(function GroupPageHeader({
  group,
  groupId,
  currentPath,
  onResetAll,
  onResetToLevel,
}: GroupPageHeaderProps) {
  const router = useRouter();

  // На страницу группы можно прийти и из дашборда, и из списка групп —
  // возвращаемся по истории. Фоллбэк на /groups при прямом заходе/новой
  // вкладке (истории нет). Drill-down использует router.replace, поэтому
  // back() уводит на страницу ДО группы, а не на шаги детализации.
  const handleBack = () => {
    if (window.history.length > 1) router.back();
    else router.push('/groups');
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="rounded-full"
            aria-label="Назад"
          >
            <ArrowLeft size={20} />
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Layers size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {group.name}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Детальный анализ показателей
              </p>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/groups/${groupId}/edit`}>
            <Edit size={16} className="mr-2" /> Настроить
          </Link>
        </Button>
      </div>

      {/* Хлебные крошки */}
      <nav className="flex items-center gap-1 text-sm flex-wrap" aria-label="Breadcrumb">
        <button
          onClick={onResetAll}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-md transition-colors",
            currentPath.length === 0
              ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-semibold"
              : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          )}
        >
          <Home size={14} /> Все данные
        </button>
        {currentPath.map((filter, idx) => {
          const isLast = idx === currentPath.length - 1;
          return (
            <span key={filter.levelId} className="flex items-center gap-1">
              <ChevronRight size={14} className="text-slate-400" />
              <button
                onClick={() => onResetToLevel(idx)}
                className={cn(
                  "px-2 py-1 rounded-md transition-colors",
                  isLast
                    ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-semibold"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
              >
                {filter.displayValue || filter.value}
              </button>
            </span>
          );
        })}
      </nav>
    </div>
  );
});