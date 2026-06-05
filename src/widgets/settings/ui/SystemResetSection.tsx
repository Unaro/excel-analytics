'use client';
import { useSystemReset } from '@/features/system-reset';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';

export function SystemResetSection() {
  const {
    isResetting,
    isDialogOpen,
    requestReset,
    cancelReset,
    performReset,
  } = useSystemReset();

  return (
    <>
      <Card className="p-6 border-l-4 border-l-red-500 bg-red-50/30 dark:bg-red-900/10 border-t-0 border-r-0 border-b-0">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-lg mt-1">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-red-700 dark:text-red-400">
              Сброс системы
            </h3>
            <p className="text-sm text-red-600/80 dark:text-red-400/70 mt-1 mb-4">
              Полная очистка локального хранилища (IndexedDB и LocalStorage).
              Все данные и настройки будут потеряны безвозвратно.
            </p>
            <Button
              variant="destructive"
              onClick={requestReset}
              disabled={isResetting}
            >
              {isResetting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Очистка...
                </>
              ) : (
                'Полный сброс'
              )}
            </Button>
          </div>
        </div>
      </Card>
      <ConfirmDialog
        open={isDialogOpen}
        onOpenChange={(open) => !open && cancelReset()}
        title="Сбросить систему?"
        description="ВНИМАНИЕ: Это действие удалит ВСЕ данные приложения (дашборды, настройки, загруженный Excel файл). Восстановление будет невозможно."
        variant="destructive"
        isLoading={isResetting}
        onConfirm={performReset}
      />
    </>
  );
}