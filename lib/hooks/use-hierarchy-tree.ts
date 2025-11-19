// lib/hooks/use-hierarchy-tree.ts
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useExcelDataStore } from '@/lib/stores/excel-data-store';
import { useHierarchyStore } from '@/lib/stores/hierarchy-store';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { buildHierarchyTree } from '@/app/actions/hierarchy';
import { HierarchyNode, HierarchyLevel } from '@/types';

export function useHierarchyTree(dashboardId: string) {
  const [treeNodes, setTreeNodes] = useState<HierarchyNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // ИСПРАВЛЕНИЕ: Выбираем сырой массив листов (SheetData[]), ссылка на который стабильна
  const sheets = useExcelDataStore((s) => s.data);

  // Преобразуем в плоский список строк с мемоизацией
  const rawData = useMemo(() => {
    if (!sheets) return [];
    return sheets.flatMap(sheet => sheet.rows);
  }, [sheets]);

  const levels = useHierarchyStore((s) => s.levels);
  const dashboard = useDashboardStore((s) => s.getDashboard(dashboardId));

  useEffect(() => {
    // Добавляем проверку на dashboard (может быть undefined до гидратации)
    if (!dashboard || rawData.length === 0 || levels.length === 0) return;

    const loadTree = async () => {
      setIsLoading(true);
      try {
        const currentFilters = dashboard.hierarchyFilters;
        
        const result = await buildHierarchyTree({
          data: rawData,
          levels: levels,
          parentFilters: currentFilters,
          includeRecordCount: true
        });

        setTreeNodes(result.nodes);
      } catch (e) {
        console.error('Failed to build hierarchy tree:', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadTree();
  }, [rawData, levels, dashboard?.hierarchyFilters, dashboardId]); // dashboard?.hierarchyFilters безопасен, т.к. это примитив/массив внутри объекта

  const nextLevel: HierarchyLevel | null = dashboard 
    ? levels[dashboard.hierarchyFilters.length] || null
    : null;

  return {
    nodes: treeNodes,
    isLoading,
    nextLevel,
    currentPath: dashboard?.hierarchyFilters || []
  };
}