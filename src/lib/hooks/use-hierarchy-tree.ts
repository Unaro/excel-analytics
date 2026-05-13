// lib/hooks/use-hierarchy-tree.ts
import { useMemo } from 'react';
import { useDashboardStore } from '@/entities/dashboard';
import { useHierarchyStore } from '@/entities/hierarchy';
import { useDatasetStore } from '@/entities/dataset';
import { getHierarchyNodesLocal } from '../logic/hierarchy-client';

/**
 * Хук для получения текущего пути иерархии дашборда
 * Используется для передачи фильтров в другие страницы
 */
export function useHierarchyTree(dashboardId: string) {
  const activeDatasetId = useDatasetStore(s => s.activeDatasetId);
  const dashboard = useDashboardStore((s) => s.getDashboard(dashboardId));
  const levels = useHierarchyStore(s => activeDatasetId ? s.getLevels(activeDatasetId) : []);
  const excelData = useDatasetStore(s => s.getAllData());

  const currentPath = dashboard?.hierarchyFilters || [];
  const nextLevel = levels[currentPath.length] || null;

  const nodes = useMemo(() => {
    if (!nextLevel || excelData.length === 0) return [];
    return getHierarchyNodesLocal(excelData, nextLevel, currentPath, !!levels[currentPath.length + 1]);
  }, [excelData, nextLevel, currentPath, levels, activeDatasetId]);

  return { nodes, isLoading: false, nextLevel, currentPath };
}