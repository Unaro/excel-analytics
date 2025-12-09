import { ExcelRow, HierarchyLevel, HierarchyFilterValue, HierarchyNode } from '@/types';

// Хелпер для нормализации значений к строке (гарантируем string для сравнения)
function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export function getHierarchyNodesLocal(
  data: ExcelRow[],
  level: HierarchyLevel,
  parentFilters: HierarchyFilterValue[] = [],
  hasNextLevel: boolean
): HierarchyNode[] {
  
  // 1. Фильтрация данных по родительским путям
  let filteredData = data;
  if (parentFilters.length > 0) {
    filteredData = data.filter(row => {
      return parentFilters.every(filter => {
        const rowVal = normalizeValue(row[filter.columnName]);
        const filterVal = normalizeValue(filter.value);
        return rowVal === filterVal;
      });
    });
  }

  // 2. Группировка
  // Ключ Map и originalValue типизируем строго как string
  const groups = new Map<string, { count: number; display: string; originalValue: string }>();

  for (const row of filteredData) {
    const rawValue = row[level.columnName];
    
    // Приводим к строке
    const key = normalizeValue(rawValue);
    
    // ГЛАВНОЕ ИЗМЕНЕНИЕ: Если значение пустое — ПРОПУСКАЕМ.
    // Никаких "Не указано", никаких "Empty". Просто игнорируем.
    if (key === '') continue;

    const display = String(rawValue).trim();

    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { 
        count: 1, 
        display, 
        originalValue: key // Сохраняем нормализованное значение как value
      });
    } else {
      existing.count++;
    }
  }

  // 3. Формирование узлов
  const nodes: HierarchyNode[] = Array.from(groups.values()).map((info) => ({
    value: info.originalValue, // string
    displayValue: info.display,
    level: level,
    childCount: hasNextLevel ? 1 : 0, // Можно уточнить подсчет, но 1 достаточно для отрисовки стрелки
    recordCount: info.count,
    isExpanded: false,
    isSelected: false
  }));

  // 4. Сортировка по алфавиту
  nodes.sort((a, b) => 
    a.displayValue.localeCompare(b.displayValue, undefined, { numeric: true })
  );

  return nodes;
}