// lib/hooks/use-hierarchy-tree.ts
import { useMemo } from 'react';
import { useDashboardStore } from '@/entities/dashboard';
import { useHierarchyStore } from '@/entities/hierarchy';
import { useDatasetStore } from '@/entities/dataset';
import { useShallow } from 'zustand/react/shallow';
import { getHierarchyNodesLocal } from '../hierarchy-client';

export function useHierarchyTree(dashboardId: string) {
  const activeDatasetId = useDatasetStore(s => s.activeDatasetId);
  
  const dashboard = useDashboardStore(useShallow(s => s.getDashboard(dashboardId)));
  const levels = useHierarchyStore(useShallow(s => 
    activeDatasetId ? s.getLevels(activeDatasetId) : []
  ));
  const excelData = useDatasetStore(useShallow(s => s.getAllData()));
  
  const currentPath = dashboard?.hierarchyFilters || [];
  const nextLevel = levels[currentPath.length] || null;
  
  const nodes = useMemo(() => {
    if (!nextLevel || excelData.length === 0) return [];
    return getHierarchyNodesLocal(excelData, nextLevel, currentPath, !!levels[currentPath.length + 1]);
  }, [excelData, nextLevel, currentPath, levels, activeDatasetId]);
  
  return { nodes, isLoading: false, nextLevel, currentPath };
}