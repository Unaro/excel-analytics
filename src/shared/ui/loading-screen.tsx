'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface LoadingScreenProps {
  message?: string;
  className?: string;
}

export function LoadingScreen({ 
  message = 'Загрузка...', 
  className 
}: LoadingScreenProps) {
  return (
    <div className={cn(
      'min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950',
      className
    )}>
      <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
        <Loader2 className="animate-spin" size={32} />
        {message && (
          <span className="text-sm font-medium">{message}</span>
        )}
      </div>
    </div>
  );
}
