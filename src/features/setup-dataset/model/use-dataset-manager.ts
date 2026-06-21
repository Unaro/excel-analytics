'use client';
import { useCallback, useState } from 'react';
import { useDatasetStore } from '@/entities/dataset';
import { toast } from '@/shared/ui/toast';
import { removeDatasetCompletely } from './remove-dataset';

interface UseDatasetManagerProps {
  onNavigateToColumns: () => void;
  onNavigateToUpload: () => void;
}

/**
 * Управление датасетами на шаге настройки: удаление (с подтверждением
 * через ConfirmDialog на стороне UI) и переключение с навигацией.
 *
 * Удаление делегируется removeDatasetCompletely — единой точке очистки
 * всех артефактов (DuckDB-таблица, Arrow-буфер, кэш, конфиги колонок).
 */
export function useDatasetManager({
  onNavigateToColumns,
  onNavigateToUpload,
}: UseDatasetManagerProps) {
  const datasets = useDatasetStore(s => s.datasets);
  const activeId = useDatasetStore(s => s.activeDatasetId);
  const switchDataset = useDatasetStore(s => s.switchDataset);

  /** Датасет, ожидающий подтверждения удаления (null — диалог закрыт). */
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  /** Открывает диалог подтверждения удаления. */
  const requestDeleteDataset = useCallback((id: string) => {
    setPendingDeleteId(id);
  }, []);

  /** Закрывает диалог без удаления. */
  const cancelDeleteDataset = useCallback(() => setPendingDeleteId(null), []);

  /** Удаляет датасет со всеми артефактами и переключает активный. */
  const confirmDeleteDataset = useCallback(async () => {
    const id = pendingDeleteId;
    if (!id) return;

    await removeDatasetCompletely(id);
    toast.info('Датасет удален');
    setPendingDeleteId(null);

    if (id === activeId) {
      // Справочники активным датасетом быть не могут
      const remainingIds = Object.values(datasets)
        .filter(ds => ds.id !== id && ds.role !== 'reference')
        .map(ds => ds.id);
      if (remainingIds.length > 0) {
        switchDataset(remainingIds[0]);
        onNavigateToColumns();
      } else {
        onNavigateToUpload();
      }
    }
  }, [pendingDeleteId, activeId, datasets, switchDataset, onNavigateToColumns, onNavigateToUpload]);

  /** Переключает активный датасет и переходит к настройке колонок. */
  const handleSwitchAndNavigate = useCallback(
    (id: string) => {
      switchDataset(id);
      onNavigateToColumns();
    },
    [switchDataset, onNavigateToColumns]
  );

  return {
    pendingDeleteId,
    requestDeleteDataset,
    cancelDeleteDataset,
    confirmDeleteDataset,
    handleSwitchAndNavigate,
  };
}
