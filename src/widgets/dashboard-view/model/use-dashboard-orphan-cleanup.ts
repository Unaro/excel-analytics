'use client';
import { useEffect } from 'react';
import { useDashboardStore } from '@/entities/dashboard';
import { useIndicatorGroupStore } from '@/entities/indicator-group';
import { toast } from 'sonner';

/**
 * Автоматически удаляет привязки к группам, которые были удалены.
 * Срабатывает один раз при монтировании виджета дашборда.
 */
export function useDashboardOrphanCleanup(dashboardId: string, hydrated: boolean) {
  const dashboard = useDashboardStore(s => s.getDashboard(dashboardId));

  useEffect(() => {
    if (!hydrated || !dashboard) return;

    const allGroups = useIndicatorGroupStore.getState().groups;
    const validGroupIds = new Set(allGroups.map(g => g.id));

    const orphanedGroups = dashboard.indicatorGroups.filter(
      g => !validGroupIds.has(g.groupId)
    );

    if (orphanedGroups.length > 0) {
      const { removeIndicatorGroup } = useDashboardStore.getState();
      orphanedGroups.forEach(g => {
        removeIndicatorGroup(dashboardId, g.groupId);
      });
      toast.warning(
        `Удалено ${orphanedGroups.length} устаревш${orphanedGroups.length === 1 ? 'ая' : 'их'} привяз${orphanedGroups.length === 1 ? 'ка' : 'ки'} групп`,
        { duration: 5000 }
      );
    }
  }, [hydrated, dashboard, dashboardId]);
}