'use client';

import { HierarchyBuilder } from '@/features/BuildHierarchy';
import { useStoreHydration } from '@/lib/hooks/use-store-hydration';
import { Loader2 } from 'lucide-react';
import { LoadingScreen } from '@/shared/ui/loading-screen';

export default function HierarchyPage() {
  const hydrated = useStoreHydration();

  if (!hydrated) {
    return <LoadingScreen message="Загрузка настройки иерархии..." />;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Настройка Иерархии</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-3xl">
          Определите структуру вложенности данных (например: <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded text-xs">Регион → Район → Город</span>).
          Это позволит создавать фильтры &quot;проводникового&quot; типа на дашбордах.
          <br/>
          <span className="text-xs opacity-70 mt-1 block">
            * В список попадают только колонки, отмеченные как <strong>Категория</strong> в разделе настройки данных.
          </span>
        </p>
      </div>
      
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm transition-colors">
        <HierarchyBuilder />
      </div>
    </div>
  );
}