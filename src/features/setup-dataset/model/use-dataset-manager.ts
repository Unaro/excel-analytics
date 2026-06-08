'use client';
import { useCallback } from 'react';
import { useDatasetStore } from '@/entities/dataset';
import { toast } from 'sonner';

interface UseDatasetManagerProps {
  onNavigateToColumns: () => void;
  onNavigateToUpload: () => void;
}

export function useDatasetManager({
  onNavigateToColumns,
  onNavigateToUpload,
}: UseDatasetManagerProps) {
  const datasets = useDatasetStore(s => s.datasets);
  const activeId = useDatasetStore(s => s.activeDatasetId);
  const switchDataset = useDatasetStore(s => s.switchDataset);
  const removeDataset = useDatasetStore(s => s.removeDataset);

  const handleDeleteDataset = useCallback(
    (id: string) => {
      if (!confirm('Удалить этот датасет? Настройки дашбордов сохранятся.')) return;

      removeDataset(id);
      toast.info('Датасет удален');

      if (id === activeId) {
        const remainingIds = Object.keys(datasets).filter(k => k !== id);
        if (remainingIds.length > 0) {
          switchDataset(remainingIds[0]);
          onNavigateToColumns();
        } else {
          onNavigateToUpload();
        }
      }
    },
    [activeId, datasets, removeDataset, switchDataset, onNavigateToColumns, onNavigateToUpload]
  );

  const handleSwitchAndNavigate = useCallback(
    (id: string) => {
      switchDataset(id);
      onNavigateToColumns();
    },
    [switchDataset, onNavigateToColumns]
  );

  return {
    handleDeleteDataset,
    handleSwitchAndNavigate,
  };
}