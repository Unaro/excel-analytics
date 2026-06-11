'use client';
import { useState, useCallback } from 'react';
import { useDashboardStore } from '@/entities/dashboard';
import { toast } from '@/shared/ui/toast';

export function useDeleteDashboard() {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const deleteDashboard = useDashboardStore(s => s.deleteDashboard);

  const requestDelete = useCallback((id: string) => setDeleteId(id), []);
  const cancelDelete = useCallback(() => setDeleteId(null), []);

  const confirmDelete = useCallback(() => {
    if (deleteId) {
      deleteDashboard(deleteId);
      toast.success('Дашборд удален');
      setDeleteId(null);
    }
  }, [deleteId, deleteDashboard]);

  return { deleteId, isConfirming: deleteId !== null, requestDelete, cancelDelete, confirmDelete };
}