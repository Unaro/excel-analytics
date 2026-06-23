'use client';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { ColumnManager } from '@/widgets/column-manager';
import { RawDataViewer } from '@/widgets/raw-data-viewer';
import { useDatasetStore } from '@/entities/dataset';
import { RawGroupsPanel } from './RawGroupsPanel';

interface ColumnSetupStepProps {
  isSyncing: boolean;
}

export function ColumnSetupStep({ isSyncing }: ColumnSetupStepProps) {
  const router = useRouter();
  const datasetId = useDatasetStore(s => s.activeDatasetId);

  if (isSyncing) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-500">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
        <span className="text-sm">Синхронизация данных...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
          1. Типы данных
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Укажите, как система должна интерпретировать каждую колонку.
        </p>
        <ColumnManager />
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
          2. Проверка данных
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Убедитесь, что данные загрузились корректно.
        </p>
        <RawDataViewer />
      </div>

      {datasetId && (
        <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
            3. Группы показателей <span className="text-sm font-normal text-slate-400">(необязательно)</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Сгруппируйте числовые колонки в показатели прямо при импорте — или
            пропустите и соберите группы позже.
          </p>
          <RawGroupsPanel datasetId={datasetId} />
        </div>
      )}

      <div className="flex justify-end pt-4 border-t dark:border-slate-800">
        <Button
          onClick={() => router.push('/hierarchy')}
          className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
        >
          Далее: Настройка иерархии →
        </Button>
      </div>
    </div>
  );
}