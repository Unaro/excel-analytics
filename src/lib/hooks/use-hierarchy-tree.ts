// lib/hooks/use-hierarchy-tree.ts
import { useMemo } from 'react';
import { useDashboardStore } from '@/entities/dashboard';
import { useHierarchyStore } from '@/entities/hierarchy';
import { useExcelDataStore } from '@/entities/excelData';
import { getHierarchyNodesLocal } from '../logic/hierarchy-client';

/**
 * Хук для получения текущего пути иерархии дашборда
 * Используется для передачи фильтров в другие страницы
 */
export function useHierarchyTree(dashboardId: string) {
  const dashboard = useDashboardStore((s) => s.getDashboard(dashboardId));
  const levels = useHierarchyStore((s) => s.levels);
  const sheets = useExcelDataStore(s => s.data);
  const excelData = useMemo(() => sheets ? sheets.flatMap(s => s.rows) : [], [sheets]);

  const currentPath = dashboard?.hierarchyFilters || [];
  const nextLevel = levels[currentPath.length] || null;

  const nodes = useMemo(() => {
    if (!nextLevel || excelData.length === 0) return [];
    return getHierarchyNodesLocal(excelData, nextLevel, currentPath, !!levels[currentPath.length + 1]);
  }, [excelData, nextLevel, currentPath, levels]);

  return { nodes, isLoading: false, nextLevel, currentPath };
}