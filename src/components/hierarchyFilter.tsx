'use client';

import { useState, useEffect, useCallback, useMemo, memo, JSX } from 'react';
import { ExcelRow } from '@/types';
import { ChevronRight, ChevronDown, Folder, FolderOpen, MapPin } from 'lucide-react';

interface HierarchyFilterProps {
  data: ExcelRow[];
  config: string[];
  onFilterChange: (filters: Record<string, string>) => void;
}

interface TreeNode {
  value: string;
  children: Map<string, TreeNode>;
  count: number;
  level: number;
}

// Упрощённый компонент узла без лишних проверок
const TreeNodeComponent = memo(({
  node,
  nodePath,
  level,
  config,
  isExpanded,
  isSelected,
  isOnPath,
  onToggle,
  onSelect,
}: {
  node: TreeNode;
  nodePath: string[];
  level: number;
  config: string[];
  isExpanded: boolean;
  isSelected: boolean;
  isOnPath: boolean;
  onToggle: () => void;
  onSelect: () => void;
}) => {
  const hasChildren = node.children.size > 0;

  return (
    <div className="relative">
      {level > 0 && (
        <div 
          className="absolute left-0 top-0 w-6 h-6 border-l-2 border-b-2 border-gray-300"
          style={{ marginLeft: `${(level - 1) * 24}px` }}
        />
      )}

      <div
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        className={`
          flex items-center gap-2 p-3 rounded-lg transition-all cursor-pointer
          ${isSelected 
            ? 'bg-gradient-to-r from-purple-100 to-blue-100 border-2 border-purple-400 shadow-md' 
            : isOnPath
              ? 'bg-blue-50 border border-blue-200 hover:bg-blue-100'
              : 'bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300'
          }
        `}
        style={{ marginLeft: `${level * 24}px` }}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="flex-shrink-0 p-1 hover:bg-gray-200 rounded transition-colors"
          >
            {isExpanded ? (
              <ChevronDown size={18} className="text-gray-600" />
            ) : (
              <ChevronRight size={18} className="text-gray-600" />
            )}
          </button>
        ) : (
          <div className="w-6" />
        )}

        <div className="flex-shrink-0">
          {hasChildren ? (
            isExpanded ? (
              <FolderOpen size={20} className={isSelected ? 'text-purple-600' : 'text-blue-500'} />
            ) : (
              <Folder size={20} className={isSelected ? 'text-purple-600' : 'text-gray-500'} />
            )
          ) : (
            <MapPin size={20} className={isSelected ? 'text-purple-600' : 'text-green-500'} />
          )}
        </div>

        <div
          className="flex-1 flex items-center justify-between"
        >
          <div>
            <span className={`font-medium ${isSelected ? 'text-purple-900' : 'text-gray-800'}`}>
              {node.value}
            </span>
            {config[level] && (
              <span className="ml-2 text-xs text-gray-500">
                ({config[level]})
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded-full ${
              isSelected 
                ? 'bg-purple-600 text-white' 
                : 'bg-gray-100 text-gray-600'
            }`}>
              {node.count}
            </span>
            {isSelected && (
              <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded-full font-semibold">
                ✓
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

TreeNodeComponent.displayName = 'TreeNodeComponent';

export function HierarchyFilter({ data, config, onFilterChange }: HierarchyFilterProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string[]>([]);

  const tree = useMemo(() => {
    if (config.length === 0 || data.length === 0) return new Map();

    const rootMap = new Map<string, TreeNode>();

    data.forEach(row => {
      let currentLevel = rootMap;
      
      config.forEach((col, level) => {
        const value = String(row[col] || '').trim();
        if (!value || value === 'null' || value === 'undefined') return;

        if (!currentLevel.has(value)) {
          currentLevel.set(value, {
            value,
            children: new Map(),
            count: 0,
            level,
          });
        }

        const node = currentLevel.get(value)!;
        node.count++;
        currentLevel = node.children;
      });
    });

    return rootMap;
  }, [data, config]);

  // СИНХРОННАЯ обработка клика - вызываем onFilterChange сразу
  const handleNodeClick = useCallback((path: string[], nodeValue: string, level: number) => {
    const newPath = [...path, nodeValue];
    
    // Сразу формируем фильтры
    const filters: Record<string, string> = {};
    newPath.forEach((value, index) => {
      if (config[index]) {
        filters[config[index]] = value;
      }
    });
    
    // Вызываем callback СИНХРОННО
    onFilterChange(filters);
    
    // Обновляем состояние
    setSelectedPath(newPath);
    
    // Раскрываем узел
    const nodeKey = newPath.join('→');
    setExpandedNodes(prev => new Set([...prev, nodeKey]));
  }, [config, onFilterChange]);

  const toggleNode = useCallback((nodeKey: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeKey)) {
        newSet.delete(nodeKey);
      } else {
        newSet.add(nodeKey);
      }
      return newSet;
    });
  }, []);

  const renderTree = useCallback((
    nodes: Map<string, TreeNode>,
    currentPath: string[] = [],
    level: number = 0
  ): JSX.Element[] => {
    const items: JSX.Element[] = [];

    nodes.forEach((node) => {
      const nodePath = [...currentPath, node.value];
      const nodeKey = nodePath.join('→');
      const isExpanded = expandedNodes.has(nodeKey);
      const hasChildren = node.children.size > 0;

      // Быстрая проверка selection
      const fullPath = nodePath;
      const isSelected = selectedPath.length === fullPath.length &&
                        selectedPath.every((v, i) => v === fullPath[i]);
      const isOnPath = fullPath.every((v, i) => selectedPath[i] === v);

      items.push(
        <div key={nodeKey}>
          <TreeNodeComponent
            node={node}
            nodePath={nodePath}
            level={level}
            config={config}
            isExpanded={isExpanded}
            isSelected={isSelected}
            isOnPath={isOnPath}
            onToggle={() => toggleNode(nodeKey)}
            onSelect={() => handleNodeClick(currentPath, node.value, level)}
          />
          
          {hasChildren && isExpanded && (
            <div className="mt-2 space-y-2">
              {renderTree(node.children, nodePath, level + 1)}
            </div>
          )}
        </div>
      );
    });

    return items;
  }, [expandedNodes, selectedPath, config, toggleNode, handleNodeClick]);

  const clearSelection = useCallback(() => {
    setSelectedPath([]);
    setExpandedNodes(new Set());
    onFilterChange({});
  }, [onFilterChange]);

  if (config.length === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 rounded-xl p-6 mb-6 border-2 border-purple-200 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-purple-900 flex items-center gap-2">
            🌳 Иерархический навигатор
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Выберите элемент в дереве для фильтрации данных
          </p>
        </div>
        
        {selectedPath.length > 0 && (
          <button
            onClick={clearSelection}
            className="px-4 py-2 bg-red-100 text-red-700 border-2 border-red-300 rounded-lg hover:bg-red-200 transition-colors font-medium text-sm"
          >
            ✕ Сбросить
          </button>
        )}
      </div>

      {selectedPath.length > 0 && (
        <div className="mb-4 p-3 bg-white border-2 border-purple-300 rounded-lg">
          <p className="text-xs text-gray-600 mb-1 font-semibold">Выбранный путь:</p>
          <div className="flex items-center gap-2 flex-wrap">
            {selectedPath.map((value, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="bg-purple-100 text-purple-900 px-3 py-1 rounded-full text-sm font-medium">
                  <span className="text-xs text-purple-600">{config[idx]}:</span> {value}
                </div>
                {idx < selectedPath.length - 1 && (
                  <ChevronRight size={16} className="text-purple-400" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {tree.size > 0 ? (
          renderTree(tree)
        ) : (
          <div className="text-center py-12 text-gray-500">
            <Folder size={48} className="mx-auto mb-3 text-gray-300" />
            <p>Нет данных для отображения</p>
            <p className="text-xs mt-1">Проверьте настройки иерархии</p>
          </div>
        )}
      </div>

      <div className="mt-4 p-3 bg-blue-100 border border-blue-300 rounded-lg text-xs text-blue-900">
        <span className="font-semibold">💡 Совет:</span> Кликните на любой узел для фильтрации. 
        Используйте стрелки для раскрытия/скрытия подуровней.
      </div>
    </div>
  );
}
