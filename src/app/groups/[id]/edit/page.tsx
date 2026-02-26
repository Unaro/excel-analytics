'use client';

import { Suspense, use } from 'react';
import { GroupBuilder } from '@/widgets/GroupBuilder';
import { useStoreHydration } from '@/lib/hooks/use-store-hydration';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/shared/ui/button';
import { LoadingScreen } from '@/shared/ui/loading-screen';

function EditGroupContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const hydrated = useStoreHydration();

  if (!hydrated) {
    return <LoadingScreen message="Загрузка редактора группы..." />;
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="rounded-full">
          <Link href="/groups">
            <ArrowLeft size={20} />
          </Link>
        </Button>

        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Редактирование группы</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Настройка метрик и источников данных</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 p-6 transition-colors">
         <GroupBuilder groupId={id} />
      </div>
    </div>
  );
}

export default function EditGroupPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingScreen message="Загрузка редактора группы..." />}>
      <EditGroupContent params={params} />
    </Suspense>
  );
}
