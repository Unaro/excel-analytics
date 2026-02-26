// hooks/use-filter-actions.ts
'use client';

import { useCallback } from 'react';
import { useDashboardStore } from '@/entities/dashboard';
import { HierarchyNode, HierarchyFilterValue } from '@/types';

export function useFilterActions(dashboardId: string) {
  const { 
    addHierarchyFilter, 
    removeHierarchyFilter, 
    clearHierarchyFilters 
  } = useDashboardStore();

  // Выбор узла в дереве
  const selectNode = useCallback((node: HierarchyNode) => {
    const filterValue: HierarchyFilterValue = {
      levelId: node.level.id,
      levelIndex: node.level.order,
      columnName: node.level.columnName,
      value: node.value,
      displayValue: node.displayValue
    };

    // Это действие автоматически удалит все фильтры глубже текущего уровня
    // и установит новое значение для текущего
    addHierarchyFilter(dashboardId, filterValue);
  }, [dashboardId, addHierarchyFilter]);

  // Сброс до определенного уровня (хлебные крошки)
  const resetToLevel = useCallback((levelId: string) => {
    // Удаляем фильтр этого уровня (и всех дочерних)
    removeHierarchyFilter(dashboardId, levelId);
  }, [dashboardId, removeHierarchyFilter]);

  // Полный сброс
  const resetAll = useCallback(() => {
    clearHierarchyFilters(dashboardId);
  }, [dashboardId, clearHierarchyFilters]);

  return {
    selectNode,
    resetToLevel,
    resetAll
  };
}