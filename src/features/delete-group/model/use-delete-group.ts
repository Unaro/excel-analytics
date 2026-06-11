'use client';
import { useState, useCallback, useMemo } from 'react';
import { useIndicatorGroupStore } from '@/entities/indicator-group';
import { useDashboardStore } from '@/entities/dashboard';
import { useDatasetStore } from '@/entities/dataset';
import { useGroupMetricConfigStore } from '@/entities/group-metric-config';
import { createComputationCache } from '@/shared/lib/storage';
import { toast } from 'sonner';

/**
 * Оркестратор каскадного удаления группы показателей.
 *
 * Координирует все затронутые сторы (entity-сторы о каскаде не знают):
 * 1. удаляет группу из своего стора;
 * 2. отвязывает её от всех дашбордов;
 * 3. инвалидирует кэш вычислений по каждому датасету;
 * 4. чистит UI-конфиги метрик группы (colorConfig и др.).
 */
export function useDeleteGroup() {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const deleteGroup = useIndicatorGroupStore(s => s.deleteGroup);

  const affectedDashboards = useMemo(() => {
    if (!deleteId) return [];
    const allDashboards = useDashboardStore.getState().dashboards;
    return allDashboards.filter(d =>
      d.indicatorGroups.some(g => g.groupId === deleteId)
    );
  }, [deleteId]);

  /** Открывает диалог подтверждения для группы. */
  const requestDelete = useCallback((id: string) => setDeleteId(id), []);

  /** Закрывает диалог без удаления. */
  const cancelDelete = useCallback(() => setDeleteId(null), []);

  /** Выполняет удаление с полным каскадом. */
  const confirmDelete = useCallback(() => {
    if (!deleteId) return;
    const affected = affectedDashboards.length;

    // 1. Своё состояние
    deleteGroup(deleteId);

    // 2. Отвязка от дашбордов
    const { dashboards, removeIndicatorGroup } = useDashboardStore.getState();
    dashboards.forEach(dashboard => {
      if (dashboard.indicatorGroups.some(g => g.groupId === deleteId)) {
        removeIndicatorGroup(dashboard.id, deleteId);
      }
    });

    // 3. Инвалидация кэша вычислений
    const datasets = useDatasetStore.getState().datasets;
    Object.entries(datasets).forEach(([datasetId, ds]) => {
      createComputationCache(ds.sourceType ?? 'file')
        .clearByDashboard(datasetId, ds.id)
        .catch(() => {});
    });

    // 4. UI-конфиги метрик группы
    useGroupMetricConfigStore.getState().clearGroupConfigs(deleteId);

    toast.success(
      affected > 0
        ? `Группа удалена, очищено ${affected} дашборд${affected === 1 ? '' : 'ов'}`
        : 'Группа удалена'
    );
    setDeleteId(null);
  }, [deleteId, affectedDashboards.length, deleteGroup]);

  return {
    deleteId,
    isConfirming: deleteId !== null,
    affectedDashboards,
    requestDelete,
    cancelDelete,
    confirmDelete,
  };
}
