// lib/hooks/use-hierarchy-tree.ts
'use client';

import { useMemo } from 'react';
import { useDashboardStore } from '@/entities/dashboard';
import { useHierarchyStore } from '@/entities/hierarchy';
import { HierarchyLevel } from '@/types';

/**
 * Хук для получения текущего пути иерархии дашборда
 * Используется для передачи фильтров в другие страницы
 */
export function useHierarchyTree(dashboardId: string) {
  const dashboard = useDashboardStore((s) => s.getDashboard(dashboardId));
  const levels = useHierarchyStore((s) => s.levels);

  const currentPath = dashboard?.hierarchyFilters || [];

  const nextLevel: HierarchyLevel | null = dashboard
    ? levels[dashboard.hierarchyFilters.length] || null
    : null;

  // Мемоизируем следующий уровень для стабильности ссылок
  const memoizedNextLevel = useMemo(() => nextLevel, [nextLevel]);

  return {
    nodes: [], // ✅ Удалено: узлы теперь вычисляются внутри HierarchyTree
    isLoading: false, // ✅ Удалено: нет загрузок
    nextLevel: memoizedNextLevel,
    currentPath
  };
}