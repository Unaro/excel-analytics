'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  ChevronRight, ChevronDown, Folder, FolderOpen, Check, Filter, X
} from 'lucide-react';
import { getHierarchyNodesLocal } from '@/lib/logic/hierarchy-client';
import { useHierarchyStore } from '@/entities/hierarchy';
import { useExcelDataStore } from '@/entities/excelData';
import { HierarchyLevel, HierarchyFilterValue, HierarchyNode } from '@/types';
import { useFilterActions } from '@/lib/hooks/use-filter-actions';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import { useShallow } from 'zustand/react/shallow';

interface TreeProps {
  dashboardId?: string;
  currentFilters: HierarchyFilterValue[];
  onFilterChange?: (filters: HierarchyFilterValue[]) => void;
}

export function HierarchyTree({ dashboardId, currentFilters, onFilterChange }: TreeProps) {
  const levels = useHierarchyStore(useShallow(s => s.levels));
  const { resetAll } = useFilterActions(dashboardId || 'profile_mode');

  const structureKey = useMemo(() => levels.map(l => l.id).join('-'), [levels]);

  const handleReset = useCallback(() => {
    if (onFilterChange) {
      onFilterChange([]);
    } else {
      resetAll();
    }
  }, [onFilterChange, resetAll]);

  // Self-Healing: Сброс если конфиг иерархии изменился
  if (currentFilters.length > 0 && levels.length > 0) {
    const isConfigValid = currentFilters.every(filter =>
      levels.some(l => l.id === filter.levelId)
    );
    if (!isConfigValid) {
      handleReset();
    }
  }

  const sheets = useExcelDataStore(useShallow(s => s.data));
  const rawData = useMemo(() => {
    if (!sheets) return [];
    return sheets.flatMap(s => s.rows);
  }, [sheets]);

  if (levels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center border-2 border-dashed rounded-xl border-slate-200 dark:border-slate-800 text-slate-400">
        <Filter size={24} className="mb-2 opacity-50" />
        <span className="text-xs">Иерархия не настроена</span>
      </div>
    );
  }

  if (rawData.length === 0) {
    return <div className="p-4 text-center text-xs text-slate-400">Нет данных</div>;
  }

  return (
    <div className="border rounded-xl bg-white dark:bg-slate-900 shadow-sm dark:border-slate-800 overflow-hidden flex flex-col h-[600px]">
      <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm flex justify-between items-center">
        <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Структура</span>
        {currentFilters.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-6 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            <X size={12} className="mr-1" /> Сброс
          </Button>
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
          customSelectHandler={onFilterChange}
        />
      </div>
    </div>
  );
}

// --- TreeNode: Рекурсивный компонент с клиентскими вычислениями ---

interface TreeNodeProps {
  dashboardId?: string;
  levelIndex: number;
  parentPath: HierarchyFilterValue[];
  levels: HierarchyLevel[];
  allData: any[];
  activeFilters: HierarchyFilterValue[];
  customSelectHandler?: (filters: HierarchyFilterValue[]) => void;
  selectedNodeValue?: string | number; // ✅ Для отслеживания выбранного узла на этом уровне
}

function TreeNode({
  dashboardId,
  levelIndex,
  parentPath,
  levels,
  allData,
  activeFilters,
  customSelectHandler,
  selectedNodeValue
}: TreeNodeProps) {
  const currentLevel = levels[levelIndex];
  const { selectNode } = useFilterActions(dashboardId || 'profile_mode');

  // Активный фильтр на текущем уровне
  const activeFilterAtThisLevel = activeFilters[levelIndex];
  const activeValueString = activeFilterAtThisLevel ? String(activeFilterAtThisLevel.value) : null;

  const hasNextLevel = levelIndex + 1 < levels.length;

  // ✅ КЛИЕНТСКИЕ ВЫЧИСЛЕНИЯ: Мемоизируем узлы
  // Пересчитываются только при изменении данных или пути родителей
  const nodes = useMemo(() => {
    if (!currentLevel) return [];
    return getHierarchyNodesLocal(allData, currentLevel, parentPath, hasNextLevel);
  }, [allData, currentLevel, parentPath, hasNextLevel]);

  // Обработчик выбора узла
  const handleSelect = (node: HierarchyNode) => {
    const newFilter: HierarchyFilterValue = {
      levelId: node.level.id,
      levelIndex: node.level.order,
      columnName: node.level.columnName,
      value: String(node.value),
      displayValue: node.displayValue
    };

    // Формируем новый путь: родители + текущий узел
    const newFiltersPath = [...parentPath, newFilter];

    if (customSelectHandler) {
      customSelectHandler(newFiltersPath);
    } else {
      selectNode(node);
    }
  };

  if (!currentLevel) return null;
  if (nodes.length === 0) {
    return <div className="py-2 text-xs text-slate-400 text-center">Нет данных</div>;
  }

  return (
    <ul className="space-y-0.5 animate-in fade-in slide-in-from-left-1 duration-200">
      {nodes.map(node => {
        const isSelected = activeValueString === String(node.value);
        const showChevron = hasNextLevel;

        return (
          <NodeItem
            key={String(node.value)}
            node={node}
            isSelected={isSelected}
            showChevron={showChevron}
            onSelect={() => handleSelect(node)}
          >
            {/* ✅ ИСПРАВЛЕНИЕ: Рендерим детей при isExpanded, а не только при isSelected */}
            {hasNextLevel && (
              <TreeNode
                dashboardId={dashboardId}
                levelIndex={levelIndex + 1}
                parentPath={[...parentPath, {
                  levelId: currentLevel.id,
                  levelIndex: currentLevel.order,
                  columnName: currentLevel.columnName,
                  value: String(node.value),
                  displayValue: node.displayValue
                }]}
                levels={levels}
                allData={allData}
                activeFilters={activeFilters}
                customSelectHandler={customSelectHandler}
                selectedNodeValue={isSelected ? node.value : undefined}
              />
            )}
          </NodeItem>
        );
      })}
    </ul>
  );
}

// --- NodeItem: Отдельный элемент с локальным состоянием раскрытия ---

interface NodeItemProps {
  node: HierarchyNode;
  isSelected: boolean;
  showChevron: boolean;
  onSelect: () => void;
  children?: React.ReactNode;
}

function NodeItem({ node, isSelected, showChevron, onSelect, children }: NodeItemProps) {
  // ✅ ИСПРАВЛЕНИЕ: Локальное состояние для сворачивания/разворачивания
  // Раскрыто если узел выбран ИЛИ если пользователь явно раскрыл его
  const [isManuallyExpanded, setIsManuallyExpanded] = useState(false);
  
  // Узел раскрыт если: (1) выбран ИЛИ (2) пользователь явно раскрыл
  const isExpanded = isSelected || isManuallyExpanded;

  // Сбрасываем manual expand когда узел больше не выбран
  const [prevIsSelected, setPrevIsSelected] = useState(isSelected);
  if (isSelected !== prevIsSelected) {
    setPrevIsSelected(isSelected);
    if (!isSelected) {
      setIsManuallyExpanded(false); // Сброс при выборе другого узла
    }
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Переключаем только если не выбран (если выбран - уже раскрыт)
    if (!isSelected) {
      setIsManuallyExpanded(!isManuallyExpanded);
    }
  };

  return (
    <li>
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer select-none transition-colors duration-200 text-sm group",
          isSelected
            ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 font-medium"
            : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        )}
        onClick={onSelect}
      >
        <div
          className={cn(
            "p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors duration-200",
            !showChevron && "opacity-0 pointer-events-none"
          )}
          onClick={showChevron ? handleToggle : undefined}
          role={showChevron ? "button" : undefined}
          tabIndex={showChevron ? 0 : -1}
          onKeyDown={(e) => {
            if (showChevron && (e.key === 'Enter' || e.key === ' ')) {
              handleToggle(e as any);
            }
          }}
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>

        <div className={cn(
          "transition-colors shrink-0",
          isSelected ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-400 group-hover:text-slate-500'
        )}>
          {isSelected ? <FolderOpen size={16} /> : <Folder size={16} />}
        </div>

        <span className="truncate flex-1">
          {node.displayValue}
        </span>

        {node.recordCount > 0 && (
          <span className={cn(
            "text-[10px] px-1.5 py-0.5 rounded-full transition-colors",
            isSelected
              ? "bg-indigo-100 dark:bg-indigo-500/30 text-indigo-600 dark:text-indigo-200"
              : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-500 group-hover:bg-slate-200 dark:group-hover:bg-slate-700"
          )}>
            {node.recordCount}
          </span>
        )}

        {isSelected && <Check size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />}
      </div>

      {/* ✅ ИСПРАВЛЕНИЕ: Рендерим детей если узел раскрыт */}
      {showChevron && isExpanded && children && (
        <div className="pl-4 ml-2.5 border-l border-slate-100 dark:border-slate-800 my-1">
          {children}
        </div>
      )}
    </li>
  );
}
