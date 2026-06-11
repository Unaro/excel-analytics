// features/setup-dataset/model/use-dataset-replace.ts
'use client';

import { useCallback, useState } from 'react';
import { replaceDatasetFile } from './sync-engine';
import { toast } from 'sonner';
import { useDashboardFilterReconciler } from './use-dashboard-filter-reconciler';

interface UseDatasetReplaceProps {
  onSuccess: (datasetId: string) => void;
}

/** Замена файла, ожидающая подтверждения пользователя. */
export interface PendingReplace {
  datasetId: string;
  datasetName: string;
  file: File;
}

/**
 * Сценарий замены файла датасета с сохранением настроек.
 *
 * Поток: выбор файла → подтверждение (ConfirmDialog на стороне UI,
 * состояние `pendingReplace`) → замена с прогресс-тостом → согласование
 * фильтров дашбордов с новой структурой колонок.
 */
export function useDatasetReplace({ onSuccess }: UseDatasetReplaceProps) {
  const { reconcileAllForDataset } = useDashboardFilterReconciler();
  const [pendingReplace, setPendingReplace] = useState<PendingReplace | null>(null);

  /** Открывает выбор файла; после выбора — диалог подтверждения. */
  const handleReplaceFile = useCallback(
    (datasetId: string, currentName: string) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.xlsx,.xls,.csv';

      input.onchange = (ev: Event) => {
        const file = (ev.target as HTMLInputElement).files?.[0];
        input.remove();
        if (!file) return;
        setPendingReplace({ datasetId, datasetName: currentName, file });
      };

      input.click();
    },
    []
  );

  /** Закрывает диалог без замены. */
  const cancelReplace = useCallback(() => setPendingReplace(null), []);

  /** Выполняет подтверждённую замену файла. */
  const confirmReplace = useCallback(async () => {
    if (!pendingReplace) return;
    const { datasetId, file } = pendingReplace;
    setPendingReplace(null);

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

        // Согласуем фильтры дашбордов с новой структурой
        reconcileAllForDataset(datasetId);

        onSuccess(datasetId);
      } else {
        toast.error(`❌ Ошибка: ${res.error}`, { id: toastId });
      }
    } catch {
      toast.error('Непредвиденная ошибка при замене', { id: toastId });
    }
  }, [pendingReplace, onSuccess, reconcileAllForDataset]);

  return { handleReplaceFile, pendingReplace, cancelReplace, confirmReplace };
}
