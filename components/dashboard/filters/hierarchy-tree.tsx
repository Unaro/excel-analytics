'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  FolderOpen, 
  Loader2,
  Trash, 
} from 'lucide-react';
import { buildHierarchyTree } from '@/app/actions/hierarchy';
import { useHierarchyStore } from '@/lib/stores/hierarchy-store';
import { useExcelDataStore } from '@/lib/stores/excel-data-store';
import { 
  HierarchyLevel, 
  HierarchyFilterValue, 
  HierarchyNode, 
  ExcelRow
} from '@/types';
import { useFilterActions } from '@/lib/hooks/use-filter-actions';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { getHierarchyNodesLocal } from '@/lib/logic/hierarchy-client';

interface TreeProps {
  dashboardId: string;
  currentFilters: HierarchyFilterValue[];
}

export function HierarchyTree({ dashboardId, currentFilters }: TreeProps) {
  const levels = useHierarchyStore(s => s.levels);
  const { resetAll } = useFilterActions(dashboardId);
  
  // Ключ для полного пересоздания дерева при смене структуры
  const structureKey = useMemo(() => {
    return levels.map(l => l.id).join('-');
  }, [levels]);

  // Self-Healing: Сброс, если фильтры не совпадают с уровнями
  useEffect(() => {
    if (currentFilters.length > 0 && levels.length > 0) {
      const isConfigValid = currentFilters.every(filter => 
        levels.some(l => l.id === filter.levelId)
      );
      const isOrderValid = currentFilters.every((filter, index) => {
        return levels[index]?.id === filter.levelId;
      });

      if (!isConfigValid || !isOrderValid) {
        resetAll();
      }
    }
  }, [structureKey, currentFilters, levels, resetAll]);

  const sheets = useExcelDataStore(s => s.data);
  const rawData = useMemo(() => {
    if (!sheets) return [];
    return sheets.flatMap(s => s.rows);
  }, [sheets]);

  if (levels.length === 0) {
    return (
      <div className="text-gray-400 text-sm p-4 text-center border-2 border-dashed rounded-xl m-2">
        Иерархия не настроена.
      </div>
    );
  }

  return (
    <div className="border rounded-xl bg-white dark:bg-slate-900 shadow-sm dark:border-slate-800 overflow-hidden flex flex-col h-[600px]">
      <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm flex justify-between items-center">
        <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Структура</span>
        {currentFilters.length > 0 && (
          <ResetButton dashboardId={dashboardId} />
        )}
      </div>
      
      <div className="overflow-y-auto flex-1 p-2 custom-scrollbar">
        <TreeNode 
          key={structureKey} 
          dashboardId={dashboardId}
          levelIndex={0}
          parentPath={[]} 
          levels={levels}
          allData={rawData}
          activeFilters={currentFilters}
        />
      </div>
    </div>
  );
}
// --- Рекурсивный Узел Дерева ---

interface TreeNodeProps {
  dashboardId: string;
  levelIndex: number;
  parentPath: HierarchyFilterValue[];
  levels: HierarchyLevel[];
  allData: ExcelRow[];
  activeFilters: HierarchyFilterValue[];
}

function TreeNode({ 
  dashboardId, levelIndex, parentPath, levels, allData, activeFilters 
}: TreeNodeProps) {
  
  // Нам больше не нужен state 'nodes', мы можем вычислить их прямо во время рендера (useMemo)
  // Это и есть "Мгновенная структура"
  const [isExpanded, setIsExpanded] = useState(false);
  
  const currentLevel = levels[levelIndex];
  const { selectNode } = useFilterActions(dashboardId);
  const activeFilterAtThisLevel = activeFilters[levelIndex];

  // АВТО-РАСКРЫТИЕ
  const shouldBeExpanded = useMemo(() => {
    if (levelIndex === 0) return true;
    const parentFilter = activeFilters[levelIndex - 1];
    const parentNode = parentPath[parentPath.length - 1];
    // Проверка на существование и совпадение (с приведением к строке)
    return parentFilter && parentNode && String(parentFilter.value) === String(parentNode.value);
  }, [levelIndex, activeFilters, parentPath]);

  // ИНИЦИАЛИЗАЦИЯ РАСКРЫТИЯ
  useEffect(() => {
    if (shouldBeExpanded || (activeFilterAtThisLevel && shouldBeExpanded)) {
      setIsExpanded(true);
    }
  }, [shouldBeExpanded, activeFilterAtThisLevel]);

  // --- ГЛАВНОЕ ИЗМЕНЕНИЕ: ВЫЧИСЛЕНИЕ УЗЛОВ НА КЛИЕНТЕ ---
  // Мы используем useMemo, чтобы пересчитывать только когда меняются данные или путь
  const nodes = useMemo(() => {
    if (!currentLevel || !allData) return [];

    // Вызываем нашу синхронную функцию
    return getHierarchyNodesLocal(
      allData,
      currentLevel,
      parentPath,
      levelIndex + 1 < levels.length // Есть ли следующий уровень?
    );
  }, [allData, currentLevel, parentPath, levelIndex, levels.length]);


  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded); // Просто переключаем, данные уже есть
  };

  if (!currentLevel) return null;

  return (
    <ul className="space-y-0.5 animate-in fade-in duration-200 slide-in-from-left-1">
      {nodes.map(node => {
        // Используем String() для надежного сравнения (как мы чинили в фильтрах)
        const isSelected = activeFilterAtThisLevel && String(activeFilterAtThisLevel.value) === String(node.value);
        const hasChildren = levelIndex + 1 < levels.length;

        return (
          <li key={node.value}>
            <div 
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer select-none transition-all duration-200 text-sm",
                isSelected 
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 font-medium" 
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
              onClick={() => selectNode(node)}
            >
              {/* Стрелка */}
              <div 
                className={cn(
                  "p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors",
                  !hasChildren && "opacity-0 pointer-events-none"
                )}
                onClick={hasChildren ? handleToggle : undefined}
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </div>

              {/* Иконка */}
              <div className={isSelected ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-400'}>
                {isSelected ? <FolderOpen size={16} /> : <Folder size={16} />}
              </div>

              <span className="truncate flex-1">{node.displayValue}</span>

              {node.recordCount > 0 && (
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full",
                  isSelected ? "bg-indigo-100 dark:bg-indigo-500/30 text-indigo-600 dark:text-indigo-200" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-500"
                )}>
                  {node.recordCount}
                </span>
              )}
            </div>

            {/* Рендер детей */}
            {hasChildren && isExpanded && (
              <div className="pl-4 ml-2.5 border-l border-slate-100 dark:border-slate-800 my-1">
                <TreeNode 
                  dashboardId={dashboardId}
                  levelIndex={levelIndex + 1}
                  parentPath={[...parentPath, {
                    levelId: currentLevel.id,
                    levelIndex: currentLevel.order,
                    columnName: currentLevel.columnName,
                    value: node.value
                  }]}
                  levels={levels}
                  allData={allData}
                  activeFilters={activeFilters}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ResetButton({ dashboardId }: { dashboardId: string }) {
  const { resetAll } = useFilterActions(dashboardId);
  return (
    <Button 
      onClick={resetAll}
      className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors"
    >
      <Trash size={14} className="mr-1" /> Сбросить
    </Button>
  );
}