'use client';

import { use } from 'react';
import { GroupBuilder } from '@/components/config/group-builder';
import { useStoreHydration } from '@/lib/hooks/use-store-hydration';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button'; // Используем наш компонент

export default function EditGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const hydrated = useStoreHydration();

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        {/* Кнопка Назад */}
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
         {/* Передаем ID в компонент */}
         <GroupBuilder groupId={id} />
      </div>
    </div>
  );
}