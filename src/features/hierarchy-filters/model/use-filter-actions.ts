// hooks/use-filter-actions.ts
'use client';

import { useCallback } from 'react';
import { useDashboardStore } from '@/entities/dashboard';
import { useDatasetStore } from '@/entities/dataset';
import { HierarchyNode } from '@/entities/hierarchy';
import { HierarchyFilterValue } from '@/shared/lib/validators';

export function useFilterActions(dashboardId: string) {
  // Экшены стора стабильны — точечные селекторы вместо подписки на весь
  // стор, которая ререндерила компонент на любое изменение любого дашборда
  // (п.7 аудита ядра).
  const addHierarchyFilter = useDashboardStore(s => s.addHierarchyFilter);
  const removeHierarchyFilter = useDashboardStore(s => s.removeHierarchyFilter);
  const clearHierarchyFilters = useDashboardStore(s => s.clearHierarchyFilters);
  const activeDatasetId = useDatasetStore(s => s.activeDatasetId);
  // Выбор узла в дереве
  const selectNode = useCallback((node: HierarchyNode) => {
    if (!activeDatasetId) return;
    const filterValue: HierarchyFilterValue = {
      levelId: node.level.id,
      levelIndex: node.level.order,
      columnName: node.level.columnName,
      value: node.value,
      displayValue: node.displayValue
    };

    addHierarchyFilter(dashboardId, filterValue);
  }, [dashboardId, activeDatasetId, addHierarchyFilter]);

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