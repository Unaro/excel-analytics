'use client';
import { useShallow } from 'zustand/react/shallow';
import { useCallback } from 'react';
import type { HierarchyFilterValue } from '@/shared/lib/validators';
import { useDashboardStore } from './store';

export function useDashboardFilters(dashboardId: string) {
  const hierarchyFilters = useDashboardStore(
    useShallow(
      useCallback(
        (s) => s.dashboards.find(d => d.id === dashboardId)?.hierarchyFilters ?? [],
        [dashboardId]
      )
    )
  );

  const setHierarchyFilters = useDashboardStore(s => s.setHierarchyFilters);

  const updateFilters = useCallback(
    (filters: HierarchyFilterValue[]) => {
      setHierarchyFilters(dashboardId, filters);
    },
    [dashboardId, setHierarchyFilters]
  );

  const clearFilters = useCallback(() => {
    setHierarchyFilters(dashboardId, []);
  }, [dashboardId, setHierarchyFilters]);

  return { hierarchyFilters, updateFilters, clearFilters };
}