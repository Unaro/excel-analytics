'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useIndicatorGroupStore } from '@/entities/indicatorGroup';
import { useStoreHydration } from '@/lib/hooks/use-store-hydration';
import { Plus, Layers, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { LoadingScreen } from '@/shared/ui/loading-screen';

export default function GroupsListPage() {
  const hydrated = useStoreHydration();
  const groups = useIndicatorGroupStore(s => s.groups);
  const deleteGroup = useIndicatorGroupStore(s => s.deleteGroup);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (!hydrated) {
    return <LoadingScreen message="Загрузка списка групп..." />;
  }

  return (
    <>
      <div className="p-8 max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Группы показателей</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Логические блоки (строки таблицы)</p>
          </div>
          <Button className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white" asChild>
            <Link href="/groups/new">
              <Plus size={18} className="mr-2" /> Новая группа
            </Link>
          </Button>
        </div>

        <div className="grid gap-4">
          {groups.length === 0 && (
            <Card className="p-12 text-center border-dashed">
              <p className="text-slate-500">Нет групп</p>
            </Card>
          )}

          {groups.map(group => (
            <Card key={group.id} className="p-5 flex items-center justify-between hover:border-emerald-400/50 transition-colors group">
              <div className="flex items-center gap-5">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <Layers size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">{group.name}</h3>
                  <div className="flex gap-3 mt-1 text-sm text-slate-500 dark:text-slate-400">
                    <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-xs">
                      Метрик: {group.metrics.length}
                    </span>
                    {group.fieldMappings.length > 0 && (
                      <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-xs text-slate-500 dark:text-slate-500 border border-transparent">
                        Колонок Excel: {group.fieldMappings.length}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 opacity-70 group-hover:opacity-100 transition-opacity">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/groups/${group.id}/edit`}>
                     <Edit size={14} className="mr-2" /> Изменить
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-slate-400 hover:text-red-500"
                  onClick={() => setDeleteId(group.id)}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Удалить группу?"
        description="Это действие нельзя отменить"
        variant="destructive"
        onConfirm={() => {
          if (deleteId) {
            deleteGroup(deleteId);
            toast.success('Группа удалена');
          }
        }}
      />
    </>
  );
}
