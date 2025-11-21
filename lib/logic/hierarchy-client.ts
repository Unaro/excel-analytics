// lib/logic/hierarchy-client.ts
import { ExcelRow, HierarchyLevel, HierarchyFilterValue, HierarchyNode } from '@/types';

// Хелпер нормализации (тот же, что мы обсуждали)
function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/**
 * Клиентская функция для построения узлов уровня.
 * Работает мгновенно без запросов к серверу.
 */
export function getHierarchyNodesLocal(
  data: ExcelRow[],
  level: HierarchyLevel,
  parentFilters: HierarchyFilterValue[] = [],
  hasNextLevel: boolean
): HierarchyNode[] {
  
  // 1. Фильтрация (O(N))
  // Если есть родительские фильтры, отсекаем лишнее
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

  // 2. Группировка (O(N))
  // Собираем уникальные значения для текущего уровня
  const groups = new Map<string, { count: number, display: string }>();

  for (const row of filteredData) {
    const rawValue = row[level.columnName];
    // Пропускаем пустые
    if (rawValue === null || rawValue === undefined || rawValue === '') continue;

    const key = normalizeValue(rawValue); // Ключ для Map
    const display = String(rawValue).trim(); // Оригинальное написание

    if (!groups.has(key)) {
      groups.set(key, { count: 0, display });
    }
    
    groups.get(key)!.count++;
  }

  // 3. Формирование узлов
  const nodes: HierarchyNode[] = Array.from(groups.entries()).map(([key, info]) => ({
    value: key,           // Нормализованное значение для фильтра
    displayValue: info.display, // Красивое значение для UI
    level: level,
    childCount: hasNextLevel ? 1 : 0, // На клиенте мы можем лениво ставить 1, или реально посчитать (чуть дольше)
    recordCount: info.count,
    isExpanded: false,
    isSelected: false
  }));

  // 4. Сортировка
  nodes.sort((a, b) => a.displayValue.localeCompare(b.displayValue));

  return nodes;
}