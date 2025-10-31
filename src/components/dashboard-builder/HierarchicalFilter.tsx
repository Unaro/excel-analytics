// src/components/dashboard-builder/HierarchicalFilter.tsx
'use client';

import { useState, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronRight, Filter, X, RotateCcw } from 'lucide-react';
import { Card } from '@/components/common';
import type { ExcelRow, HierarchyFilters } from '@/types';

interface HierarchicalFilterProps {
  hierarchyConfig: string[];
  data: ExcelRow[];
  currentFilters: HierarchyFilters;
  onFiltersChange: (filters: HierarchyFilters) => void;
  className?: string;
}

interface LevelData {
  level: string;
  values: string[];
  selectedValue?: string;
  filteredData: ExcelRow[];
}

export function HierarchicalFilter({
  hierarchyConfig,
  data,
  currentFilters,
  onFiltersChange,
  className = '',
}: HierarchicalFilterProps) {
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set(hierarchyConfig));
  
  const levelsData = useMemo((): LevelData[] => {
    if (!data || hierarchyConfig.length === 0) return [];
    
    const result: LevelData[] = [];
    let currentData = data;
    
    for (let i = 0; i < hierarchyConfig.length; i++) {
      const level = hierarchyConfig[i];
      const selectedValue = currentFilters[level];
      
      const values = Array.from(
        new Set(
          currentData
            .map(row => String(row[level] || ''))
            .filter(val => val !== '' && val !== 'null' && val !== 'undefined')
        )
      ).sort();
      
      result.push({ level, values, selectedValue, filteredData: currentData });
      
      if (selectedValue) {
        currentData = currentData.filter(row => String(row[level]) === selectedValue);
      } else {
        break;
      }
    }
    
    return result;
  }, [hierarchyConfig, data, currentFilters]);
  
  const filteredDataCount = useMemo(() => {
    let filtered = data;
    
    Object.entries(currentFilters).forEach(([level, value]) => {
      if (value && hierarchyConfig.includes(level)) {
        filtered = filtered.filter(row => String(row[level]) === value);
      }
    });
    
    return filtered.length;
  }, [data, currentFilters, hierarchyConfig]);
  
  const toggleLevel = (level: string) => {
    const newExpanded = new Set(expandedLevels);
    if (newExpanded.has(level)) newExpanded.delete(level); else newExpanded.add(level);
    setExpandedLevels(newExpanded);
  };
  
  const selectValue = useCallback((level: string, value: string | null) => {
    const newFilters = { ...currentFilters };
    
    if (value === null) {
      const levelIndex = hierarchyConfig.indexOf(level);
      hierarchyConfig.slice(levelIndex).forEach(l => { delete newFilters[l]; });
    } else {
      newFilters[level] = value;
      const levelIndex = hierarchyConfig.indexOf(level);
      hierarchyConfig.slice(levelIndex + 1).forEach(l => { delete newFilters[l]; });
    }
    
    onFiltersChange(newFilters);
  }, [currentFilters, hierarchyConfig, onFiltersChange]);
  
  const resetAllFilters = () => { onFiltersChange({}); };
  
  const hasActiveFilters = Object.keys(currentFilters).length > 0;
  
  if (hierarchyConfig.length === 0) {
    return (
      <Card className={className}>
        <div className="text-center py-8 text-gray-500">
          <Filter className="w-12 h-12 mx-auto mb-3 opacity-50" aria-label="Иерархия не настроена" />
          <p className="text-sm">Иерархическая структура не настроена.<br />Перейдите в настройки для конфигурации.</p>
        </div>
      </Card>
    );
  }
  
  return (
    <Card 
      title="Иерархические фильтры"
      rightBadge={
        hasActiveFilters ? (
          <button onClick={resetAllFilters} className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors" aria-label="Сбросить все фильтры">
            <RotateCcw className="w-3 h-3" />
            Сбросить
          </button>
        ) : null
      }
      className={className}
    >
      <div className="space-y-1">
        {hasActiveFilters && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-blue-800 font-medium">Отфильтровано: {filteredDataCount.toLocaleString()} из {data.length.toLocaleString()} строк</span>
              <span className="text-blue-600 text-xs">{Math.round((filteredDataCount / data.length) * 100)}%</span>
            </div>
          </div>
        )}
        
        <div className="space-y-0.5">
          {levelsData.map((levelData, index) => {
            const isExpanded = expandedLevels.has(levelData.level);
            const hasSelection = levelData.selectedValue !== undefined;
            const indentLevel = index;
            
            return (
              <div key={levelData.level}>
                <div className="flex items-center gap-2 py-2 px-3 hover:bg-gray-50 rounded cursor-pointer transition-colors" style={{ paddingLeft: `${12 + indentLevel * 16}px` }} onClick={() => toggleLevel(levelData.level)}>
                  <button className="p-0.5" aria-label={isExpanded ? 'Свернуть уровень' : 'Развернуть уровень'}>
                    {levelData.values.length > 0 ? (
                      isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )
                    ) : (
                      <div className="w-4 h-4" />
                    )}
                  </button>
                  
                  <span className={`font-medium ${hasSelection ? 'text-blue-600' : 'text-gray-700'}`}>{levelData.level}</span>
                  {hasSelection && (<span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{levelData.selectedValue}</span>)}
                  <span className="text-xs text-gray-500">({levelData.values.length} вариантов)</span>
                  {hasSelection && (
                    <button onClick={(e) => { e.stopPropagation(); selectValue(levelData.level, null); }} className="p-1 hover:bg-red-100 rounded transition-colors" aria-label="Сбросить фильтр">
                      <X className="w-3 h-3 text-red-500" />
                    </button>
                  )}
                </div>
                
                {isExpanded && levelData.values.length > 0 && (
                  <div className="space-y-0.5">
                    {levelData.values.map((value) => {
                      const isSelected = levelData.selectedValue === value;
                      return (
                        <button key={value} onClick={() => selectValue(levelData.level, value)} className={`w-full text-left py-1.5 px-3 rounded text-sm transition-colors ${isSelected ? 'bg-blue-100 text-blue-800 font-medium' : 'hover:bg-gray-100 text-gray-700'}`} style={{ paddingLeft: `${28 + indentLevel * 16}px` }}>
                          <span className="truncate">{value}</span>
                          {isSelected && (<span className="ml-2 text-xs text-blue-600">✓</span>)}
                        </button>
                      );
                    })}
                  </div>
                )}
                
                {isExpanded && levelData.values.length === 0 && (
                  <div className="py-2 px-3 text-xs text-gray-500 italic" style={{ paddingLeft: `${28 + indentLevel * 16}px` }}>
                    Нет доступных значений
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {levelsData.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" aria-label="Нет данных для фильтрации" />
            <p className="text-sm">Данные для фильтрации недоступны</p>
          </div>
        )}
      </div>
    </Card>
  );
}
