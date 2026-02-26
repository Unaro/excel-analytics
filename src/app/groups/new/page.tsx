'use client';

import { GroupBuilder } from '@/widgets/GroupBuilder';
import { ArrowLeft, Layers, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/shared/ui/button';
import { useStoreHydration } from '@/lib/hooks/use-store-hydration';

export default function NewGroupPage() {
  const hydrated = useStoreHydration();

  if (!hydrated) return <Loader2 />;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 p-8 transition-colors">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Хедер */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="rounded-full">
            <Link href="/groups">
              <ArrowLeft size={20} />
            </Link>
          </Button>
          
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg">
               <Layers size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Новая группа показателей</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Создайте набор метрик и свяжите их с данными</p>
            </div>
          </div>
        </div>

        {/* Контейнер формы */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 p-6 transition-colors">
           {/* groupId не передаем, так как создаем новую */}
           <GroupBuilder />
        </div>
      </div>
    </div>
  );
}