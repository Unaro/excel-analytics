'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  ChevronRight, ChevronDown, Folder, FolderOpen, Check, Filter, X 
} from 'lucide-react';
import { getHierarchyNodesLocal } from '@/lib/logic/hierarchy-client';
import { useHierarchyStore } from '@/lib/stores/hierarchy-store';
import { useExcelDataStore } from '@/lib/stores/excel-data-store';
import { 
  HierarchyLevel, HierarchyFilterValue, HierarchyNode, ExcelRow 
} from '@/types';
import { useFilterActions } from '@/lib/hooks/use-filter-actions';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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

  // Self-Healing
  useEffect(() => {
    if (currentFilters.length > 0 && levels.length > 0) {
      const isConfigValid = currentFilters.every(filter => 
        levels.some(l => l.id === filter.levelId)
      );
      if (!isConfigValid) handleReset();
    }
  }, [structureKey, levels, currentFilters, handleReset]);

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
             variant="ghost" size="sm" onClick={handleReset} 
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

// --- TreeNode ---

interface TreeNodeProps {
  dashboardId?: string;
  levelIndex: number;
  parentPath: HierarchyFilterValue[];
  levels: HierarchyLevel[];
  allData: ExcelRow[];
  activeFilters: HierarchyFilterValue[];
  customSelectHandler?: (filters: HierarchyFilterValue[]) => void;
}

function TreeNode({ 
  dashboardId, levelIndex, parentPath, levels, allData, activeFilters, customSelectHandler
}: TreeNodeProps) {
  
  const currentLevel = levels[levelIndex];
  const { selectNode } = useFilterActions(dashboardId || 'profile_mode');

  // Определяем, какой фильтр сейчас активен на ЭТОМ уровне (если есть)
  const activeFilterAtThisLevel = activeFilters[levelIndex];
  
  // Приводим к строке для надежного сравнения
  const activeValueString = activeFilterAtThisLevel ? String(activeFilterAtThisLevel.value) : null;
  
  const hasNextLevel = levelIndex + 1 < levels.length;

  // --- ЛОГИКА РАСКРЫТИЯ (Derived State Pattern) ---
  // Мы должны быть раскрыты, если на этом уровне что-то выбрано.
  // Это нужно, чтобы показать детей выбранного узла.
  // Но сам узел (TreeNode) — это список. Раскрыт ли СПИСОК? Нет, TreeNode рендерит список элементов.
  // Элемент списка (li) раскрывается.
  
  // Мы используем простой useState для локального управления "стрелочками",
  // но при маунте или изменении фильтров синхронизируем его.

  // Вычисляем узлы
  const nodes = useMemo(() => {
    if (!currentLevel) return [];
    return getHierarchyNodesLocal(allData, currentLevel, parentPath, hasNextLevel);
  }, [allData, currentLevel, parentPath, hasNextLevel]);

  // Обработчик выбора
  const handleSelect = (node: HierarchyNode) => {
    // 1. Создаем фильтр для текущего кликнутого узла
    const newFilter: HierarchyFilterValue = {
      levelId: node.level.id,
      levelIndex: node.level.order,
      columnName: node.level.columnName,
      value: String(node.value), // Строгая типизация
      displayValue: node.displayValue
    };

    // 2. ФОРМИРУЕМ НОВЫЙ ПУТЬ
    // Мы берем путь родителя + текущий узел.
    // Это автоматически "отрезает" всё, что было глубже, если мы переключили ветку.
    const newFiltersPath = [...parentPath, newFilter];

    if (customSelectHandler) {
      customSelectHandler(newFiltersPath);
    } else {
      selectNode(node);
    }
  };

  if (!currentLevel) return null;

  return (
    <ul className="space-y-0.5 animate-in fade-in slide-in-from-left-1 duration-200">
      {nodes.map(node => {
        // Узел выбран, если его значение совпадает с активным фильтром на этом уровне
        const isSelected = activeValueString === String(node.value);
        
        // Показываем стрелочку, если есть след. уровень
        const showChevron = hasNextLevel;

        return (
          <NodeItem 
            key={String(node.value)}
            node={node}
            isSelected={isSelected}
            showChevron={showChevron}
            onSelect={() => handleSelect(node)}
          >
            {/* Рендерим детей ТОЛЬКО если этот узел выбран */}
            {hasNextLevel && isSelected && (
              <TreeNode 
                dashboardId={dashboardId}
                levelIndex={levelIndex + 1}
                // Новый parentPath для детей — это текущий parentPath + этот узел
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
              />
            )}
          </NodeItem>
        );
      })}
    </ul>
  );
}

// Вынесли отдельный Item, чтобы изолировать стейт раскрытия (хотя теперь раскрытие зависит от isSelected)
interface NodeItemProps {
  node: HierarchyNode;
  isSelected: boolean;
  showChevron: boolean;
  onSelect: () => void;
  children?: React.ReactNode;
}

function NodeItem({ node, isSelected, showChevron, onSelect, children }: NodeItemProps) {
  // Локальное состояние для сворачивания/разворачивания УЖЕ ВЫБРАННОГО узла
  // Если узел выбран, он по умолчанию развернут.
  const [isExpanded, setIsExpanded] = useState(isSelected);

  // Sync state if selection changes
  // Используем паттерн "State derived from props"
  const [prevIsSelected, setPrevIsSelected] = useState(isSelected);
  if (isSelected !== prevIsSelected) {
    setPrevIsSelected(isSelected);
    setIsExpanded(isSelected); // Авто-раскрытие при выборе
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Если мы кликаем на стрелочку, мы просто сворачиваем/разворачиваем детей,
    // но НЕ меняем выбор (если узел уже выбран).
    setIsExpanded(!isExpanded);
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

      {/* Рендерим детей */}
      {showChevron && isExpanded && children && (
        <div className="pl-4 ml-2.5 border-l border-slate-100 dark:border-slate-800 my-1">
          {children}
        </div>
      )}
    </li>
  );
}