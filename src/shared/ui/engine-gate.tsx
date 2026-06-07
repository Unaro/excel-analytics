'use client';

import { useEffect } from 'react';
import { useEngineStatus } from '@/shared/lib/hooks/use-engine-status';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { AlertCircle, Loader2, RefreshCw, Database } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/shared/lib/utils';

interface EngineGateProps {
  children: React.ReactNode;
  /** Куда редиректить при отсутствии данных */
  fallbackHref?: string;
  /** Сообщение при отсутствии данных */
  emptyMessage?: string;
  className?: string;
}

/**
 * Gate-компонент для защиты страниц дашбордов и групп.
 * 
 * Логика:
 *  - status === 'ready' → рендерим children
 *  - status === 'loading' → спиннер "Инициализация движка..."
 *  - status === 'disconnected' → UI с кнопкой "Перезагрузить"
 *  - status === 'error' → UI "Файл утерян, загрузите заново"
 *  - status === 'no-data' → редирект на fallbackHref (обычно /setup)
 * 
 * При disconnected пытается auto-recovery один раз при монтировании.
 * Если auto-recovery не сработал — показывает кнопку ручной перезагрузки.
 */
export function EngineGate({
  children,
  fallbackHref = '/setup',
  emptyMessage = 'Нет загруженных данных',
  className,
}: EngineGateProps) {
  const { status, reload, isReloading } = useEngineStatus();
  const router = useRouter();
  
  // Auto-recovery при первом монтировании (если disconnected)
  useEffect(() => {

    console.log(status)
    if (status === 'disconnected') {
      reload();
    }
  }, [status, reload]);
  
  if (status === 'ready') {
    return <>{children}</>;
  }
  
  if (status === 'no-data') {
    return (
      <div className={cn(
        "min-h-[60vh] flex items-center justify-center p-8",
        className
      )}>
        <Card className="max-w-md w-full p-8 text-center border-dashed border-2">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Database className="text-slate-400" size={32} />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            {emptyMessage}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Загрузите Excel или CSV файл, чтобы начать работу с дашбордами.
          </p>
          <Button onClick={() => router.push(fallbackHref)} className="w-full">
            Перейти к загрузке
          </Button>
        </Card>
      </div>
    );
  }
  
  if (status === 'loading' || (status === 'disconnected' && isReloading)) {
    return (
      <div className={cn(
        "min-h-[60vh] flex items-center justify-center p-8",
        className
      )}>
        <Card className="max-w-md w-full p-8 text-center">
          <Loader2 className="animate-spin text-indigo-500 mx-auto mb-4" size={40} />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            Восстановление движка...
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Загружаем данные из кэша. Это займёт несколько секунд.
          </p>
        </Card>
      </div>
    );
  }
  
  if (status === 'disconnected') {
    return (
      <div className={cn(
        "min-h-[60vh] flex items-center justify-center p-8",
        className
      )}>
        <Card className="max-w-md w-full p-8 text-center border-amber-200 dark:border-amber-800">
          <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="text-amber-500" size={32} />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            Движок отключился
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Web Worker с DuckDB был остановлен браузером. 
            Данные сохранены в кэше и могут быть восстановлены.
          </p>
          <div className="flex flex-col gap-2">
            <Button onClick={() => reload()} className="w-full gap-2">
              <RefreshCw size={16} /> Перезагрузить движок
            </Button>
            <Button variant="outline" onClick={() => router.push(fallbackHref)} className="w-full">
              Загрузить файл заново
            </Button>
          </div>
        </Card>
      </div>
    );
  }
  
  // status === 'error'
  return (
    <div className={cn(
      "min-h-[60vh] flex items-center justify-center p-8",
      className
    )}>
      <Card className="max-w-md w-full p-8 text-center border-rose-200 dark:border-rose-800">
        <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="text-rose-500" size={32} />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
          Файл утерян
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Кэш данных повреждён или отсутствует. Необходимо загрузить файл заново.
          <br /><br />
          <span className="text-xs opacity-70">
            Все настройки дашбордов, метрик и групп сохранятся.
          </span>
        </p>
        <Button onClick={() => router.push(fallbackHref)} className="w-full">
          Загрузить файл
        </Button>
      </Card>
    </div>
  );
}