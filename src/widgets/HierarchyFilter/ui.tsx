'use client';
import { memo, useState, useMemo, useCallback, useEffect } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, Check, Filter, X } from 'lucide-react';
import { HierarchyLevel, HierarchyNode, useHierarchyStore } from '@/entities/hierarchy';
import { useDatasetStore } from '@/entities/dataset';
import { useColumnConfigStore } from '@/entities/columnConfig';
import { useDashboardStore } from '@/entities/dashboard';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import { useShallow } from 'zustand/react/shallow';
import { useFilterActions } from '@/features/hierarchy-filters/model/use-filter-actions';
import { HierarchyFilterValue } from '@/shared/lib/validators';
import { useHierarchyLevelNodes } from '@/lib/hooks/use-hierarchy-level-nodes';

const EMPTY_PATH: HierarchyFilterValue[] = [];

// ─────────────────────────────────────────────────────────────────────────────
// ROOT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export interface TreeProps {
  dashboardId?: string;
  currentFilters: HierarchyFilterValue[];
  onFilterChange?: (filters: HierarchyFilterValue[]) => void;
}

export function HierarchyTree({ dashboardId, currentFilters, onFilterChange }: TreeProps) {
  const activeDatasetId = useDatasetStore(s => s.activeDatasetId);
  const levels = useHierarchyStore(useShallow(s => activeDatasetId ? s.getLevels(activeDatasetId) : []));
  const { resetAll } = useFilterActions(dashboardId || 'profile_mode');
  const hasData = useDatasetStore(s => s.hasData());
  
  const structureKey = useMemo(() => levels.map((l: HierarchyLevel) => l.id).join('-'), [levels]);

  const handleReset = useCallback(() => {
    if (onFilterChange) onFilterChange([]);
    else resetAll();
  }, [onFilterChange, resetAll]);

  useEffect(() => {
    if (currentFilters.length > 0 && levels.length > 0) {
      const isConfigValid = currentFilters.every(filter => levels.some(l => l.id === filter.levelId));
      if (!isConfigValid) handleReset();
    }
  }, [currentFilters, levels, handleReset]);

  if (levels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center border-2 border-dashed rounded-xl border-slate-200 dark:border-slate-800 text-slate-400">
        <Filter size={24} className="mb-2 opacity-50" />
        <span className="text-xs">Иерархия не настроена</span>
      </div>
    );
  }

  if (!hasData) {
    return <div className="p-4 text-center text-xs text-slate-400">Нет данных</div>;
  }

  return (
    <div className="border rounded-xl bg-white dark:bg-slate-900 shadow-sm dark:border-slate-800 overflow-hidden flex flex-col h-[600px]">
      <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm flex justify-between items-center">
        <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Структура</span>
        {currentFilters.length > 0 && (
          <Button variant="ghost" size="sm" onClick={handleReset} className="h-6 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
            <X size={12} className="mr-1" /> Сброс
          </Button>
        )}
      </div>
      <div className="overflow-y-auto flex-1 p-2 custom-scrollbar">
        <TreeNode
          key={structureKey}
          dashboardId={dashboardId}
          levelIndex={0}
          parentPath={EMPTY_PATH}
          levels={levels}
          activeFilters={currentFilters}
          customSelectHandler={onFilterChange}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TREE NODE (MEMOIZED)
// ─────────────────────────────────────────────────────────────────────────────
interface TreeNodeProps {
  dashboardId?: string;
  levelIndex: number;
  parentPath: HierarchyFilterValue[];
  levels: HierarchyLevel[];
  activeFilters: HierarchyFilterValue[];
  customSelectHandler?: (filters: HierarchyFilterValue[]) => void;
}

const TreeNode = memo(function TreeNode({
  dashboardId,
  levelIndex,
  parentPath,
  levels,
  activeFilters,
  customSelectHandler,
}: TreeNodeProps) {
  const currentLevel = levels[levelIndex];
  const activeDatasetId = useDatasetStore(s => s.activeDatasetId);
  const setHierarchyFilters = useDashboardStore(s => s.setHierarchyFilters);
  
  const columnClassification = useColumnConfigStore(s => {
    if (!activeDatasetId || !currentLevel) return 'categorical';
    const cfg = s.getConfigs(activeDatasetId).find(c => c.columnName === currentLevel.columnName);
    return cfg?.classification || 'categorical';
  });

  const hasNextLevel = levelIndex + 1 < levels.length;
  
  const { nodes, isLoading } = useHierarchyLevelNodes(currentLevel ?? null, parentPath, hasNextLevel);

  const activeFilterAtThisLevel = activeFilters.find(f => f.levelId === currentLevel?.id);
  const activeValueString = activeFilterAtThisLevel ? String(activeFilterAtThisLevel.value) : null;

  const handleSelect = useCallback((node: HierarchyNode) => {
    const baseFilter: HierarchyFilterValue = {
      levelId: node.level.id,
      levelIndex: node.level.order,
      columnName: node.level.columnName,
      value: String(node.value),
      displayValue: node.displayValue,
    };

    const newFilter: HierarchyFilterValue = columnClassification === 'date'
      ? { ...baseFilter, operator: 'between', value2: String(node.value) }
      : baseFilter;

    const newPath = [...parentPath, newFilter];

    if (customSelectHandler) {
      customSelectHandler(newPath);
    } else {
      setHierarchyFilters(dashboardId || 'profile_mode', newPath);
    }
  }, [parentPath, columnClassification, customSelectHandler, setHierarchyFilters, dashboardId]);

  if (!currentLevel) return null;

  if (isLoading) {
    return (
      <div className="py-2 text-xs text-slate-400 text-center flex items-center justify-center gap-2">
        <div className="inline-block animate-spin rounded-full h-3 w-3 border-2 border-slate-400 border-t-transparent" />
        <span>Загрузка...</span>
      </div>
    );
  }

  if (nodes.length === 0) {
    return <div className="py-2 text-xs text-slate-400 text-center">Нет данных на этом уровне</div>;
  }

  return (
    <ul className="space-y-0.5 animate-in fade-in slide-in-from-left-1 duration-200">
      {nodes.map(node => (
        <NodeItem
          key={String(node.value)}
          node={node}
          isSelected={activeValueString === String(node.value)}
          showChevron={hasNextLevel}
          onSelect={() => handleSelect(node)}
          levelIndex={levelIndex}
          parentPath={parentPath}
          levels={levels}
          activeFilters={activeFilters}
          customSelectHandler={customSelectHandler}
          dashboardId={dashboardId}
        />
      ))}
    </ul>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// NODE ITEM (STRICTLY TYPED & ISOLATED)
// ─────────────────────────────────────────────────────────────────────────────
interface NodeItemProps {
  node: HierarchyNode;
  isSelected: boolean;
  showChevron: boolean;
  onSelect: () => void;
  levelIndex: number;
  parentPath: HierarchyFilterValue[];
  levels: HierarchyLevel[];
  activeFilters: HierarchyFilterValue[];
  customSelectHandler?: (filters: HierarchyFilterValue[]) => void;
  dashboardId?: string;
}

const NodeItem = memo(function NodeItem({
  node,
  isSelected,
  showChevron,
  onSelect,
  levelIndex,
  parentPath,
  levels,
  activeFilters,
  customSelectHandler,
  dashboardId
}: NodeItemProps) {
  const [isManuallyExpanded, setIsManuallyExpanded] = useState(false);
  const isExpanded = isSelected || isManuallyExpanded;

  useEffect(() => {
    if (!isSelected) setIsManuallyExpanded(false);
  }, [isSelected]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isSelected) setIsManuallyExpanded(prev => !prev);
  };

  const childPath = useMemo<HierarchyFilterValue[]>(() => [
    ...parentPath,
    {
      levelId: node.level.id,
      levelIndex: node.level.order,
      columnName: node.level.columnName,
      value: String(node.value),
      displayValue: node.displayValue
    }
  ], [parentPath, node.level.id, node.level.order, node.level.columnName, node.value, node.displayValue]);

  return (
    <li>
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer select-none transition-colors duration-200 text-sm group",
          isSelected ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 font-medium" : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        )}
        onClick={onSelect}
      >
        <div
          className={cn("p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors duration-200", !showChevron && "opacity-0 pointer-events-none")}
          onClick={showChevron ? handleToggle : undefined}
          role={showChevron ? "button" : undefined}
          tabIndex={showChevron ? 0 : -1}
          onKeyDown={(e) => { if (showChevron && (e.key === 'Enter' || e.key === ' ')) handleToggle(e as unknown as React.MouseEvent); }}
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
        <div className={cn("transition-colors shrink-0", isSelected ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-400 group-hover:text-slate-500')}>
          {isSelected ? <FolderOpen size={16} /> : <Folder size={16} />}
        </div>
        <span className="truncate flex-1">{node.displayValue}</span>
        {node.recordCount > 0 && (
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full transition-colors", isSelected ? "bg-indigo-100 dark:bg-indigo-500/30 text-indigo-600 dark:text-indigo-200" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-500 group-hover:bg-slate-200 dark:group-hover:bg-slate-700")}>
            {node.recordCount}
          </span>
        )}
        {isSelected && <Check size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />}
      </div>
      {showChevron && isExpanded && (
        <div className="pl-4 ml-2.5 border-l border-slate-100 dark:border-slate-800 my-1">
          <TreeNode
            dashboardId={dashboardId}
            levelIndex={levelIndex + 1}
            parentPath={childPath}
            levels={levels}
            activeFilters={activeFilters}
            customSelectHandler={customSelectHandler}
          />
        </div>
      )}
    </li>
  );
});