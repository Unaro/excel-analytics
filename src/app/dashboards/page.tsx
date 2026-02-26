'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useDashboardStore } from '@/entities/dashboard';
import { useStoreHydration } from '@/lib/hooks/use-store-hydration';
import { Plus, LayoutDashboard, ArrowRight, Trash2, Settings } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { LoadingScreen } from '@/shared/ui/loading-screen';

export default function DashboardsListPage() {
  const hydrated = useStoreHydration();
  const dashboards = useDashboardStore(s => s.dashboards);
  const deleteDashboard = useDashboardStore(s => s.deleteDashboard);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (!hydrated) {
    return <LoadingScreen message="Загрузка списка дашбордов..." />;
  }

  return (
    <>
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Дашборды</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Ваши аналитические панели</p>
          </div>
          <Button asChild>
            <Link href="/dashboards/new">
              <Plus size={18} className="mr-2" /> Создать
            </Link>
          </Button>
        </div>

        {dashboards.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-20 border-dashed">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <LayoutDashboard className="text-slate-400" size={32} />
            </div>
            <h3 className="text-lg font-medium text-slate-900 dark:text-white">Нет дашбордов</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6">Создайте первый отчет для анализа данных</p>
            <Button variant="outline" asChild>
              <Link href="/dashboards/new">Создать сейчас</Link>
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dashboards.map(dashboard => (
              <Card key={dashboard.id} className="group hover:border-indigo-300 dark:hover:border-indigo-700">
                <div className="p-5 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="p-2.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
                      <LayoutDashboard size={24} />
                    </div>

                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                         <Link href={`/dashboards/${dashboard.id}/edit`} title="Настройки">
                           <Settings size={16} />
                         </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => setDeleteId(dashboard.id)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-1 truncate">{dashboard.name}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 h-10">
                      {dashboard.description || 'Нет описания'}
                    </p>
                  </div>

                  <div className="flex gap-2">
                     <div className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-slate-600 dark:text-slate-400">
                       {dashboard.virtualMetrics.length} колонок
                     </div>
                     <div className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-slate-600 dark:text-slate-400">
                       {dashboard.indicatorGroups.length} групп
                     </div>
                  </div>
                </div>

                <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex justify-between items-center rounded-b-xl">
                  <div className="text-xs text-slate-400">
                    {new Date(dashboard.updatedAt).toLocaleDateString()}
                  </div>
                  <Link
                    href={`/dashboards/${dashboard.id}`}
                    className="text-sm font-medium text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:gap-2 transition-all"
                  >
                    Открыть <ArrowRight size={14} />
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Удалить дашборд?"
        description="Это действие нельзя отменить"
        variant="destructive"
        onConfirm={() => {
          if (deleteId) {
            deleteDashboard(deleteId);
            toast.success('Дашборд удален');
          }
        }}
      />
    </>
  );
}
