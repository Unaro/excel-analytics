'use server';

import type {
  ExcelRow,
  HierarchyLevel,
  HierarchyFilterValue,
  HierarchyTreeResult,
  HierarchyNode,
} from '@/types';

/**
 * Хелпер нормализации (такой же как в compute.ts)
 * Лучше вынести его в utils, но можно и продублировать для надежности серверных экшенов
 */
function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/**
 * Построение дерева иерархии
 * Используется в hooks/use-hierarchy-tree.ts
 */
export async function buildHierarchyTree(params: {
  data: ExcelRow[];
  levels: HierarchyLevel[];
  parentFilters?: HierarchyFilterValue[];
  maxDepth?: number;
  includeRecordCount?: boolean;
}): Promise<HierarchyTreeResult> {
  const startTime = Date.now();
  
  const {
    data,
    levels,
    parentFilters = [],
    maxDepth = 5,
    includeRecordCount = true,
  } = params;
  
  // Базовые проверки
  if (levels.length === 0 || data.length === 0) {
    return { nodes: [], totalRecords: 0, buildTime: 0 };
  }
  
  // Определяем текущий уровень, который нужно построить
  // Если есть 1 фильтр (Страна=Россия), значит строим уровень с индексом 1 (Города)
  const currentLevelIndex = parentFilters.length;
  
  // Если мы уже углубились максимально или уровни кончились
  if (currentLevelIndex >= levels.length || currentLevelIndex >= maxDepth) {
    return {
      nodes: [],
      totalRecords: filterByParentFilters(data, parentFilters).length,
      buildTime: Date.now() - startTime,
    };
  }
  
  const currentLevel = levels[currentLevelIndex];
  
  // 1. Фильтруем данные по родительским фильтрам
  const filteredData = filterByParentFilters(data, parentFilters);
  
  // 2. Группируем данные по значениям текущего уровня
  const groupedData = new Map<string, ExcelRow[]>();
  
  for (const row of filteredData) {
    const rawValue = row[currentLevel.columnName];
    
    // Пропускаем пустые значения в иерархии
    if (rawValue === null || rawValue === undefined || rawValue === '') continue;
    
    const key = String(rawValue);
    
    if (!groupedData.has(key)) {
      groupedData.set(key, []);
    }
    groupedData.get(key)!.push(row);
  }
  
  // 3. Формируем узлы дерева
  const nodes: HierarchyNode[] = [];
  
  for (const [value, rows] of groupedData.entries()) {
    // Проверяем, есть ли дети (следующий уровень)
    const hasChildrenLevel = currentLevelIndex + 1 < levels.length;
    let childCount = 0;
    
    if (hasChildrenLevel) {
      const nextLevel = levels[currentLevelIndex + 1];
      // Считаем уникальные значения следующего уровня
      const childValues = new Set();
      for (const r of rows) {
        const v = r[nextLevel.columnName];
        if (v != null && v !== '') childValues.add(String(v));
      }
      childCount = childValues.size;
    }
    
    nodes.push({
      value: value,
      displayValue: value, // Можно расширить логику, если есть словарь названий
      level: currentLevel,
      childCount,
      recordCount: includeRecordCount ? rows.length : 0,
      isExpanded: false, // Для UI
      isSelected: false,
    });
  }
  
  // Сортировка по алфавиту
  nodes.sort((a, b) => a.displayValue.localeCompare(b.displayValue, 'ru'));
  
  return {
    nodes,
    totalRecords: filteredData.length,
    buildTime: Date.now() - startTime,
  };
}

/**
 * Вспомогательная функция фильтрации
 * ИСПРАВЛЕННАЯ ВЕРСИЯ
 */
function filterByParentFilters(
  data: ExcelRow[],
  filters: HierarchyFilterValue[]
): ExcelRow[] {
  if (filters.length === 0) return data;
  
  return data.filter(row => {
    return filters.every(filter => {
      const rowVal = normalizeValue(row[filter.columnName]);
      const filterVal = normalizeValue(filter.value);
      
      return rowVal === filterVal;
    });
  });
}