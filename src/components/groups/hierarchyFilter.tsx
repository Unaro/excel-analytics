// src/components/groups/hierarchyFilter.tsx (обновленная версия для единственного выбора)
'use client';

import { useState, useEffect } from 'react';
import type { ExcelRow, HierarchyFilters } from '@/types';
import { HierarchyTree } from '@/components/common/hierarchy/HierarchyTree';
import { HierarchyHeader } from '@/components/common/hierarchy';

interface HierarchyFilterProps {
  data: ExcelRow[];
  config: string[]; // уровни иерархии по порядку
  initialFilters?: HierarchyFilters;
  onFilterChange: (filters: HierarchyFilters) => void;
}

export default function HierarchyFilter({
  data,
  config,
  initialFilters = {},
  onFilterChange,
}: HierarchyFilterProps) {
  // Конвертируем initialFilters в один выбранный путь
  const [selectedPath, setSelectedPath] = useState<string[] | null>(() => {
    const entries = Object.entries(initialFilters);
    if (entries.length === 0) return null;
    
    // Находим самый глубокий уровень
    let deepestPath: string[] = [];
    entries.forEach(([level, value]) => {
      const levelIndex = config.indexOf(level);
      if (levelIndex >= 0 && value) {
        const path = config.slice(0, levelIndex + 1).map(l => 
          initialFilters[l] || ''
        ).filter(Boolean);
        if (path.length > deepestPath.length) {
          deepestPath = path;
        }
      }
    });
    
    return deepestPath.length > 0 ? deepestPath : null;
  });

  useEffect(() => {
    // Конвертируем выбранный путь обратно в HierarchyFilters
    const filters: HierarchyFilters = {};
    
    if (selectedPath) {
      selectedPath.forEach((value, index) => {
        if (index < config.length) {
          const levelName = config[index];
          filters[levelName] = value;
        }
      });
    }
    
    onFilterChange(filters);
  }, [selectedPath, config, onFilterChange]);

  return (
    <div className="space-y-4">
      <HierarchyHeader
        title="Иерархический фильтр"
        subtitle={`Выберите один элемент на любом уровне иерархии: ${config.join(' → ')}`}
      />
      
      <HierarchyTree
        data={data}
        levels={config}
        selectedPath={selectedPath}
        onSelectionChange={setSelectedPath}
        maxHeight="500px"
      />
      
      {selectedPath && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm font-medium text-blue-900 mb-2">
            Выбранный фильтр:
          </p>
          <div className="text-sm text-blue-800">
            <span className="font-mono">{selectedPath.join(' → ')}</span>
          </div>
        </div>
      )}
    </div>
  );
}
