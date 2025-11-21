'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  FolderOpen, 
  Loader2, 
  Check, 
  Filter, 
  X 
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
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useShallow } from 'zustand/shallow';

interface TreeProps {
  dashboardId?: string; // Необязательный, так как в режиме Профиля его нет
  currentFilters: HierarchyFilterValue[];
  // Колбэк для режима Профиля (когда фильтр управляется извне, например через URL)
  onFilterChange?: (filters: HierarchyFilterValue[]) => void;
}

export function HierarchyTree({ dashboardId, currentFilters, onFilterChange }: TreeProps) {

  const levels = useHierarchyStore(useShallow(s => s.levels));
  
  // Хук действий (используем заглушку ID, если мы в режиме профиля, чтобы хук не упал)
  const { resetAll } = useFilterActions(dashboardId || 'profile_mode');
  
  const structureKey = useMemo(() => levels.map(l => l.id).join('-'), [levels]);

  // Функция сброса зависит от режима
  const handleReset = useCallback(() => {
    if (onFilterChange) {
      onFilterChange([]); // Режим профиля: очищаем внешний стейт
    } else {
      resetAll(); // Режим дашборда: очищаем стор
    }
  }, [onFilterChange, resetAll]);

  // Self-Healing: Сброс, если конфиг изменился и фильтры стали невалидны
  useEffect(() => {
    if (currentFilters.length > 0 && levels.length > 0) {
      const isConfigValid = currentFilters.every(filter => 
        levels.some(l => l.id === filter.levelId)
      );
      const isOrderValid = currentFilters.every((filter, index) => {
        return levels[index]?.id === filter.levelId;
      });

      if (!isConfigValid || !isOrderValid) {
        handleReset();
      }
    }
  }, [structureKey, currentFilters, levels, handleReset]);

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
          customSelectHandler={onFilterChange} // Передаем колбэк вниз
        />
      </div>
    </div>
  );
}

// --- Рекурсивный Узел Дерева ---

interface TreeNodeProps {
  dashboardId?: string;
  levelIndex: number;
  parentPath: HierarchyFilterValue[];
  levels: HierarchyLevel[];
  allData: ExcelRow[];
  activeFilters: HierarchyFilterValue[];
  // Колбэк для режима профиля
  customSelectHandler?: (filters: HierarchyFilterValue[]) => void;
}

function TreeNode({ 
  dashboardId, 
  levelIndex, 
  parentPath, 
  levels, 
  allData, 
  activeFilters,
  customSelectHandler
}: TreeNodeProps) {
  const [nodes, setNodes] = useState<HierarchyNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  
  const currentLevel = levels[levelIndex];
  const { selectNode } = useFilterActions(dashboardId || 'profile_mode');

  const activeFilterAtThisLevel = activeFilters[levelIndex];

  const shouldBeExpanded = useMemo(() => {
    if (levelIndex === 0) return true;
    const parentFilter = activeFilters[levelIndex - 1];
    const parentNode = parentPath[parentPath.length - 1];
    
    // Безопасное сравнение строк
    return parentFilter && parentNode && String(parentFilter.value) === String(parentNode.value);
  }, [levelIndex, activeFilters, parentPath]);

  // Используем ключ для разрыва цикла зависимостей
  const parentPathKey = JSON.stringify(parentPath);

  const loadNodes = useCallback(async () => {
    if (!currentLevel || nodes.length > 0) return;
    
    setIsLoading(true);
    try {
      const res = await buildHierarchyTree({
        data: allData,
        levels,
        parentFilters: parentPath,
        includeRecordCount: true
      });
      setNodes(res.nodes);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allData, levels, parentPathKey, nodes.length, currentLevel]); 

  useEffect(() => {
    let mounted = true;
    if (!currentLevel) return;

    const init = async () => {
      if (shouldBeExpanded) {
        if (nodes.length === 0 && !isLoading) {
            await loadNodes();
        }
        if (activeFilterAtThisLevel && mounted) {
           // Используем setTimeout чтобы избежать ошибки setState during render
           setTimeout(() => setIsExpanded(true), 0);
        }
      }
    };
    
    init();
    return () => { mounted = false; };
  }, [shouldBeExpanded, activeFilterAtThisLevel, loadNodes, nodes.length, isLoading, currentLevel]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isExpanded && nodes.length === 0) {
      await loadNodes();
    }
    setIsExpanded(!isExpanded);
  };

  // Обработчик выбора узла
  const handleSelect = (node: HierarchyNode) => {
    if (customSelectHandler) {
      // ЛОГИКА ДЛЯ ПРОФИЛЯ:
      // Создаем новый фильтр для текущего узла
      const newFilter: HierarchyFilterValue = {
        levelId: node.level.id,
        levelIndex: node.level.order,
        columnName: node.level.columnName,
        value: node.value,
        displayValue: node.displayValue
      };
      // Добавляем его к пути родителей (это и есть новый полный фильтр)
      const newFiltersPath = [...parentPath, newFilter];
      customSelectHandler(newFiltersPath);
    } else {
      // ЛОГИКА ДЛЯ ДАШБОРДА (через стор)
      selectNode(node);
    }
  };

  if (!currentLevel) return null;

  if (isLoading && nodes.length === 0) {
    return <div className="pl-6 py-2"><Loader2 size={14} className="animate-spin text-slate-400"/></div>;
  }

  return (
    <ul className="space-y-0.5">
      {nodes.map(node => {
        const isSelected = activeFilterAtThisLevel && String(activeFilterAtThisLevel.value) === String(node.value);
        const hasChildren = levelIndex + 1 < levels.length;

        return (
          <li key={node.value}>
            <div 
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer select-none transition-colors duration-300 text-sm",
                isSelected 
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 font-medium" 
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
              onClick={() => handleSelect(node)}
            >
              <div 
                className={cn(
                  "p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors duration-300 ",
                  !hasChildren && "opacity-0 pointer-events-none"
                )}
                onClick={hasChildren ? handleToggle : undefined}
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </div>

              <div className={isSelected ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-400'}>
                {isSelected ? <FolderOpen size={16} /> : <Folder size={16} />}
              </div>

              <span className="truncate flex-1">
                {node.displayValue}
              </span>

              {node.recordCount > 0 && (
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full",
                  isSelected ? "bg-indigo-100 dark:bg-indigo-500/30 text-indigo-600 dark:text-indigo-200" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-500"
                )}>
                  {node.recordCount}
                </span>
              )}
              
              {isSelected && <Check size={14} className="text-indigo-600 dark:text-indigo-400" />}
            </div>

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
                  customSelectHandler={customSelectHandler}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}