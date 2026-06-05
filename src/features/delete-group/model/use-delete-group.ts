'use client';
import { useState, useCallback, useMemo } from 'react';
import { useIndicatorGroupStore } from '@/entities/indicatorGroup';
import { useDashboardStore } from '@/entities/dashboard';
import { toast } from 'sonner';

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

  const requestDelete = useCallback((id: string) => setDeleteId(id), []);
  const cancelDelete = useCallback(() => setDeleteId(null), []);

  const confirmDelete = useCallback(() => {
    if (deleteId) {
      const affected = affectedDashboards.length;
      deleteGroup(deleteId);
      toast.success(
        affected > 0
          ? `Группа удалена, очищено ${affected} дашборд${affected === 1 ? '' : 'ов'}`
          : 'Группа удалена'
      );
      setDeleteId(null);
    }
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