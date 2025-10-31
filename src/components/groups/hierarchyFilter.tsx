'use client';

import { useState, useCallback, useMemo, memo, JSX } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, MapPin, X, Check, AlertCircle } from 'lucide-react';
import { getHierarchyColumns } from '@/lib/metadata-manager';
import { getFieldTypes } from '@/lib/field-type-store';
import type { ExcelRow, HierarchyFilters } from '@/types';

interface HierarchyFilterProps {
  data: ExcelRow[];
  config: string[];
  onFilterChange: (filters: HierarchyFilters) => void;
  initialFilters?: HierarchyFilters;
}

interface TreeNode {
  value: string;
  children: Map<string, TreeNode>;
  count: number;
  level: number;
}

const TreeNodeComponent = memo((
  {
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
  }
) => {
  const hasChildren = node.children.size > 0;

  return (
    <div>
      {level > 0 && <div className="h-px bg-gray-200 ml-8" />}

      <div className="flex items-center gap-0" style={{ marginLeft: `${level * 28}px` }}>
        {hasChildren ? (
          <button
            onClick={onToggle}
            className="flex-shrink-0 p-1 hover:bg-gray-300 rounded transition-colors"
            aria-label={isExpanded ? 'Свернуть' : 'Развернуть'}
            tabIndex={0}
          >
            {isExpanded ? (
              <ChevronDown className="w-5 h-5 text-gray-600" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-600" />
            )}
          </button>
        ) : (
          <div className="w-7" />
        )}

        <button
          onClick={onSelect}
          className={`
            flex-1 flex items-center gap-3 px-4 py-3 rounded-lg transition-all cursor-pointer text-left
            ${isSelected
              ? 'bg-gradient-to-r from-purple-100 to-blue-100 border-2 border-purple-500 shadow-md'
              : isOnPath
              ? 'bg-blue-50 border border-blue-300'
              : 'bg-white border border-gray-200 hover:bg-gray-50'
            }
          `}
        >
          {hasChildren ? (
            isExpanded ? (
              <FolderOpen className="w-5 h-5 text-blue-500 flex-shrink-0" />
            ) : (
              <Folder className="w-5 h-5 text-gray-400 flex-shrink-0" />
            )
          ) : (
            <MapPin className="w-5 h-5 text-green-500 flex-shrink-0" />
          )}

          <span className="flex-1 font-medium text-gray-900">{node.value}</span>

          {config[level] && (
            <span className="text-xs text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full flex-shrink-0">
              {config[level]}
            </span>
          )}

          <span className="text-xs text-gray-500 mx-2 flex-shrink-0">({node.count})</span>

          {isSelected && (
            <div className="flex-shrink-0 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
              <Check className="w-4 h-4 text-white" />
            </div>
          )}
        </button>
      </div>
    </div>
  );
});

TreeNodeComponent.displayName = 'TreeNodeComponent';

export function HierarchyFilter({
  data,
  config,
  onFilterChange,
  initialFilters = {},
}: HierarchyFilterProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string[]>(
    config.length > 0 && Object.keys(initialFilters).length > 0
      ? config.map((col) => initialFilters[col] || '').filter(Boolean)
      : []
  );

  const fieldTypes = getFieldTypes();

  // Получаем только поля, которые разрешены для использования в иерархии
  const allowedHierarchyFields = useMemo(() => {
    return getHierarchyColumns(config);
  }, [config]);

  // Проверяем, что все поля иерархии разрешены
  const hasInvalidFields = useMemo(() => {
    return config.some((field) => !allowedHierarchyFields.includes(field));
  }, [config, allowedHierarchyFields]);

  const tree = useMemo(() => {
    if (config.length === 0 || data.length === 0) return new Map<string, TreeNode>();

    const rootMap = new Map<string, TreeNode>();

    for (const row of data) {
      let currentLevel = rootMap;

      for (const col of config) {
        const value = String(row[col] || '').trim();

        if (!value || value === 'null' || value === 'undefined') continue;

        if (!currentLevel.has(value)) {
          currentLevel.set(value, {
            value,
            children: new Map(),
            count: 0,
            level: config.indexOf(col),
          });
        }

        const node = currentLevel.get(value)!;
        node.count++;
        currentLevel = node.children;
      }
    }

    return rootMap;
  }, [data, config]);

  const handleNodeClick = useCallback(
    (path: string[], nodeValue: string): void => {
      const newPath = [...path, nodeValue];

      const filters: HierarchyFilters = {};
      for (let i = 0; i < newPath.length; i++) {
        if (config[i]) {
          filters[config[i]] = newPath[i];
        }
      }

      onFilterChange(filters);
      setSelectedPath(newPath);

      const nodeKey = newPath.join('→');
      setExpandedNodes((prev) => new Set([...prev, nodeKey]));
    },
    [config, onFilterChange]
  );

  const toggleNode = useCallback((nodeKey: string): void => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(nodeKey)) {
        newSet.delete(nodeKey);
      } else {
        newSet.add(nodeKey);
      }
      return newSet;
    });
  }, []);

  const renderTree = useCallback(
    (nodes: Map<string, TreeNode>, currentPath: string[] = [], level: number = 0): JSX.Element[] => {
      const items: JSX.Element[] = [];

      for (const node of nodes.values()) {
        const nodePath = [...currentPath, node.value];
        const nodeKey = nodePath.join('→');
        const isExpanded = expandedNodes.has(nodeKey);
        const childrenExist = node.children.size > 0;

        const isSelected =
          selectedPath.length === nodePath.length &&
          selectedPath.every((v, i) => v === nodePath[i]);

        const isOnPath = nodePath.every((v, i) => selectedPath[i] === v);

        items.push(
          <TreeNodeComponent
            key={nodeKey}
            node={node}
            nodePath={nodePath}
            level={level}
            config={config}
            isExpanded={isExpanded}
            isSelected={isSelected}
            isOnPath={isOnPath}
            onToggle={() => toggleNode(nodeKey)}
            onSelect={() => handleNodeClick(currentPath, node.value)}
          />
        );

        if (childrenExist && isExpanded) {
          items.push(
            <div key={`children-${nodeKey}`}>
              {renderTree(node.children, nodePath, level + 1)}
            </div>
          );
        }
      }

      return items;
    },
    [expandedNodes, selectedPath, config, toggleNode, handleNodeClick]
  );

  const clearSelection = useCallback((): void => {
    setSelectedPath([]);
    setExpandedNodes(new Set());
    onFilterChange({});
  }, [onFilterChange]);

  if (config.length === 0) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
        Конфигурация иерархии не задана
      </div>
    );
  }

  if (hasInvalidFields) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-2">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-800">
            <p className="font-medium mb-1">Проблема с конфигурацией иерархии</p>
            <p>
              Некоторые поля не отмечены как &quot;Использовать в иерархии&quot; в разделе &quot;Основные&quot;
              настроек. Пожалуйста, отметьте их там.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
        Нет данных для отображения иерархии
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 flex items-center">
          <MapPin className="w-5 h-5 text-purple-500 mr-2" />
          Иерархический навигатор
        </h3>
        {selectedPath.length > 0 && (
          <button
            onClick={clearSelection}
            className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors flex items-center"
          >
            <X className="w-4 h-4 mr-1" />
            Сбросить
          </button>
        )}
      </div>

      {selectedPath.length > 0 && (
        <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg">
          <div className="text-sm font-semibold text-blue-900 mb-3">
            ✓ Выбранный путь ({selectedPath.length}/{config.length}):
          </div>
          <div className="space-y-2">
            {selectedPath.map((value, idx) => (
              <div key={idx} className="flex items-center text-sm">
                <span className="text-gray-600 min-w-fit">{config[idx]}:</span>
                <span className="ml-2 px-3 py-1 bg-blue-200 text-blue-900 rounded-full font-semibold">
                  {value}
                </span>
              </div>
            ))}
          </div>
          {selectedPath.length < config.length && (
            <p className="text-xs text-blue-700 mt-3 p-2 bg-blue-100 rounded">
              💡 Вы выбрали промежуточный уровень. Продолжите выбирать для более точной фильтрации.
            </p>
          )}
        </div>
      )}

      <div className="border border-gray-300 rounded-lg p-4 bg-white max-h-96 overflow-y-auto shadow-sm">
        {tree.size > 0 ? (
          <div className="space-y-1">
            {renderTree(tree)}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p className="font-medium mb-1">Нет данных для отображения</p>
            <p className="text-sm">Проверьте наличие данных в выбранных колонках</p>
          </div>
        )}
      </div>

      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 space-y-2">
        <p className="font-medium">💡 Как пользоваться:</p>
        <ul className="list-disc list-inside text-xs space-y-1">
          <li>Используйте стрелки для раскрытия уровней иерархии</li>
          <li>Кликните на узел для выбора (можно выбирать любой уровень)</li>
          <li>Выбранный путь будет применен как фильтр</li>
        </ul>
      </div>
    </div>
  );
}

export default HierarchyFilter;
