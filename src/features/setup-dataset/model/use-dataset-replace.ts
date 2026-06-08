// features/setup-dataset/model/use-dataset-replace.ts
'use client';

import { useCallback } from 'react';
import { replaceDatasetFile } from '@/entities/dataset';
import { toast } from 'sonner';
import { useDashboardFilterReconciler } from './use-dashboard-filter-reconciler';

interface UseDatasetReplaceProps {
  onSuccess: (datasetId: string) => void;
}

export function useDatasetReplace({ onSuccess }: UseDatasetReplaceProps) {
  const { reconcileAllForDataset } = useDashboardFilterReconciler();

  const handleReplaceFile = useCallback(
    async (datasetId: string, currentName: string) => {
      // 1. Диалог выбора файла
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.xlsx,.xls,.csv';

      input.onchange = async (ev: Event) => {
        const file = (ev.target as HTMLInputElement).files?.[0];
        if (!file) return;
        input.remove();

        // 2. Диалог подтверждения
        const confirmed = window.confirm(
          `Заменить файл для датасета "${currentName}"?\n\n` +
            `⚠️ Это действие:\n` +
            `• Загрузит новые данные в DuckDB\n` +
            `• Сохранит настройки колонок (классификацию, алиасы)\n` +
            `• Сбросит кэш вычислений дашбордов\n` +
            `• Пометит удалённые колонки как "скрытые" (не удалит)\n\n` +
            `Продолжить?`
        );
        if (!confirmed) return;

        // 3. Выполняем замену
        const toastId = 'replace-' + Date.now();
        toast.loading('Замена файла...', { id: toastId });

        try {
          const res = await replaceDatasetFile(datasetId, file);
          if (res.success) {
            const addedCount = res.addedColumns?.length ?? 0;
            const removedCount = res.removedColumns?.length ?? 0;

            let message =
              `✅ Датасет обновлён\n` +
              `Добавлено колонок: ${addedCount}\n` +
              `Удалено колонок: ${removedCount}`;

            if (res.removedColumns && res.removedColumns.length > 0) {
              const preview = res.removedColumns.slice(0, 3).join(', ');
              const more =
                res.removedColumns.length > 3
                  ? ` и ещё ${res.removedColumns.length - 3}`
                  : '';
              message +=
                `\n⚠️ Удалены: ${preview}${more}\n` +
                `Они помечены как "скрытые" в настройках колонок.`;
            }

            toast.success(message, { id: toastId, duration: 8000 });

            // ✅ 4. Согласуем фильтры дашбордов с новой структурой
            reconcileAllForDataset(datasetId);

            onSuccess(datasetId);
          } else {
            toast.error(`❌ Ошибка: ${res.error}`, { id: toastId });
          }
        } catch {
          toast.error('Непредвиденная ошибка при замене', { id: toastId });
        }
      };

      input.click();
    },
    [onSuccess, reconcileAllForDataset]
  );

  return { handleReplaceFile };
}