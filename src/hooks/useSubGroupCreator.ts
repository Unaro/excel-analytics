import { ExcelRow } from "@/types";
import { Group } from "@/types/dashboard";
import { useCallback } from "react";

// src/hooks/useSubGroupCreator.ts
interface SubGroupCreatorProps {
  parentGroup: Group;
  hierarchyConfig: string[];
  data: ExcelRow[];
}

export function useSubGroupCreator({
  parentGroup,
  hierarchyConfig,
  data
}: SubGroupCreatorProps) {
  
  const getNextLevelValues = useCallback(() => {
    // Находим текущий уровень в иерархии
    const currentFilters = parentGroup.hierarchyFilters || {};
    const filtersKeys = Object.keys(currentFilters);
    const currentLevelIndex = hierarchyConfig.findIndex(level => 
      filtersKeys.includes(level)
    );
    
    if (currentLevelIndex === -1 || currentLevelIndex === hierarchyConfig.length - 1) {
      return { nextLevel: null, values: [] };
    }
    
    const nextLevel = hierarchyConfig[currentLevelIndex + 1];
    
    // Фильтруем данные по текущим фильтрам
    const filteredData = data.filter(row => {
      return Object.entries(currentFilters).every(([level, value]) => 
        row[level] === value
      );
    });
    
    // Получаем уникальные значения следующего уровня
    const values = Array.from(new Set(
      filteredData.map(row => row[nextLevel])
        .filter(val => val !== null && val !== undefined)
        .map(val => String(val))
    )).sort();
    
    return { nextLevel, values };
  }, [parentGroup, hierarchyConfig, data]);
  
  const createSubGroups = useCallback((
    onCreateGroup: (group: Omit<Group, 'id' | 'createdAt' | 'updatedAt'>) => void
  ) => {
    const { nextLevel, values } = getNextLevelValues();
    if (!nextLevel || values.length === 0) return [];
    
    return values.map(value => {
      const subGroup: Omit<Group, 'id' | 'createdAt' | 'updatedAt'> = {
        name: `${parentGroup.name} - ${value}`,
        description: `Автосоздано из "${parentGroup.name}" для ${nextLevel}: ${value}`,
        hierarchyFilters: {
          ...parentGroup.hierarchyFilters,
          [nextLevel]: value
        },
        filters: [...parentGroup.filters], // копируем дополнительные фильтры
        indicators: [...parentGroup.indicators] // копируем показатели
      };
      
      onCreateGroup(subGroup);
      return subGroup;
    });
  }, [parentGroup, getNextLevelValues]);
  
  return {
    getNextLevelValues,
    createSubGroups
  };
}
