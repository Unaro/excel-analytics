// src/components/common/hierarchy/HierarchyTree.tsx (улучшенная версия)
'use client';

import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Check } from 'lucide-react';

export interface TreeNode {
  value: string | number;
  label: string;
  level: number;
  path: string[]; // путь от корня до текущего узла
  children: TreeNode[];
  parent?: TreeNode;
}

interface HierarchyTreeProps {
  data: Record<string, string | number | boolean | null | undefined>[];
  levels: string[];
  selectedPath: string[] | null;
  onSelectionChange: (path: string[] | null) => void;
  maxHeight?: string;
}

export function HierarchyTree({
  data,
  levels,
  selectedPath,
  onSelectionChange,
  maxHeight = '400px',
}: HierarchyTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Строим дерево из данных
  const tree = useMemo(() => {
    if (!levels.length || !data.length) return [];

    const root: TreeNode[] = [];
    const nodeMap = new Map<string, TreeNode>();

    // Обрабатываем каждую строку данных
    data.forEach(row => {
      let currentLevel = root;
      let currentPath: string[] = [];

      levels.forEach((levelKey, levelIndex) => {
        const value = row[levelKey];
        if (value == null) return;

        const stringValue = String(value);
        currentPath = [...currentPath, stringValue];
        const pathKey = currentPath.join(' → ');

        // Ищем узел на текущем уровне
        let node = currentLevel.find(n => n.value === stringValue);
        
        if (!node) {
          // Создаем новый узел
          node = {
            value: stringValue,
            label: stringValue,
            level: levelIndex,
            path: [...currentPath],
            children: [],
          };

          currentLevel.push(node);
          nodeMap.set(pathKey, node);
        }

        // Переходим к детям для следующего уровня
        currentLevel = node.children;
      });
    });

    return root;
  }, [data, levels]);

  const getNodeKey = (node: TreeNode): string => {
    return node.path.join(' → ');
  };

  const isExpanded = (node: TreeNode): boolean => {
    return expandedNodes.has(getNodeKey(node));
  };

  const toggleExpand = (node: TreeNode) => {
    const key = getNodeKey(node);
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedNodes(newExpanded);
  };

  const isSelected = (node: TreeNode): boolean => {
    if (!selectedPath) return false;
    return selectedPath.length === node.path.length && 
           selectedPath.every((val, idx) => val === String(node.path[idx]));
  };

  const isInSelectedPath = (node: TreeNode): boolean => {
    if (!selectedPath) return false;
    // Проверяем, находится ли этот узел на пути к выбранному узлу
    return selectedPath.length > node.path.length &&
           node.path.every((val, idx) => val === String(selectedPath[idx]));
  };

  const toggleSelection = (node: TreeNode) => {
    const nodePathStrings = node.path.map(String);
    
    // Если узел уже выбран, снимаем выбор
    if (isSelected(node)) {
      onSelectionChange(null);
    } else {
      // Иначе выбираем этот узел (заменяем предыдущий выбор)
      onSelectionChange(nodePathStrings);
    }
  };

  const renderNode = (node: TreeNode, depth = 0): React.ReactNode => {
    const hasChildren = node.children.length > 0;
    const expanded = isExpanded(node);
    const selected = isSelected(node);
    const inSelectedPath = isInSelectedPath(node);
    const nodeKey = getNodeKey(node);

    return (
      <div key={nodeKey} className="select-none">
        <div
          className={`flex items-center py-2 px-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors ${
            selected ? 'bg-blue-50 border border-blue-200' : 
            inSelectedPath ? 'bg-blue-25 border border-blue-100' : ''
          }`}
          style={{ marginLeft: `${depth * 20}px` }}
          onClick={() => toggleSelection(node)} // Основной обработчик клика на всю строку
        >
          {/* Кнопка раскрытия */}
          <button
            onClick={(e) => {
              e.stopPropagation(); // Останавливаем всплытие, чтобы не сработал toggleSelection
              if (hasChildren) toggleExpand(node);
            }}
            className={`mr-2 p-1 rounded hover:bg-gray-200 transition-colors ${
              !hasChildren ? 'invisible' : ''
            }`}
          >
            {hasChildren && expanded && <ChevronDown className="w-4 h-4" />}
            {hasChildren && !expanded && <ChevronRight className="w-4 h-4" />}
          </button>

          {/* Радио-кнопка - теперь не кликабельная, только визуальный индикатор */}
          <div
            className={`mr-3 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
              selected
                ? 'bg-blue-500 border-blue-500 text-white'
                : 'border-gray-300'
            }`}
          >
            {selected && <Check className="w-3 h-3" />}
          </div>

          {/* Метка узла - тоже не нужен отдельный обработчик */}
          <span
            className={`flex-1 text-sm transition-colors ${
              selected ? 'font-semibold text-blue-700' : 
              inSelectedPath ? 'font-medium text-blue-600' : 'text-gray-700'
            }`}
          >
            {node.label}
          </span>

          {/* Индикатор уровня */}
          <span className="text-xs text-gray-400 ml-2">
            {levels[node.level]}
          </span>
        </div>

        {/* Дочерние узлы */}
        {hasChildren && expanded && (
          <div className="ml-2">
            {node.children
              .sort((a, b) => String(a.value).localeCompare(String(b.value)))
              .map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const expandAll = () => {
    const allKeys = new Set<string>();
    const traverse = (nodes: TreeNode[]) => {
      nodes.forEach(node => {
        if (node.children.length > 0) {
          allKeys.add(getNodeKey(node));
          traverse(node.children);
        }
      });
    };
    traverse(tree);
    setExpandedNodes(allKeys);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  const clearSelection = () => {
    onSelectionChange(null);
  };

  if (tree.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>Нет данных для построения иерархии</p>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg">
      {/* Панель управления */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50">
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
          >
            Развернуть всё
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={collapseAll}
            className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
          >
            Свернуть всё
          </button>
        </div>
        
        {selectedPath && (
          <button
            onClick={clearSelection}
            className="text-sm text-red-600 hover:text-red-700 transition-colors"
          >
            Очистить выбор
          </button>
        )}
      </div>

      {/* Дерево */}
      <div 
        className="p-2 overflow-y-auto"
        style={{ maxHeight }}
      >
        {tree
          .sort((a, b) => String(a.value).localeCompare(String(b.value)))
          .map(node => renderNode(node))}
      </div>
    </div>
  );
}
