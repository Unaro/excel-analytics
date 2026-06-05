'use client';

import Link from 'next/link';
import { Button } from '@/shared/ui/button';

export function GroupNotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-950 gap-4">
      <div className="text-xl font-bold text-slate-900 dark:text-white">
        Группа не найдена
      </div>
      <Button variant="ghost" asChild>
        <Link href="/groups">Вернуться к списку</Link>
      </Button>
    </div>
  );
}