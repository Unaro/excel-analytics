// src/hooks/useSubGroupCreator.ts
import { ExcelRow } from "@/types";
import { Group } from "@/lib/data-store";
import { useCallback, useMemo } from "react";
import { applyFilters } from "@/lib/excel-parser";

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
  
  // Находим следующий уровень в иерархии
  const getNextLevelValues = useCallback(() => {
    // Получаем текущие иерархические фильтры
    const currentFilters = parentGroup.hierarchyFilters || {};
    const filterKeys = Object.keys(currentFilters);
    
    if (filterKeys.length === 0) {
      // Если нет иерархических фильтров, используем первый уровень из конфигурации
      if (hierarchyConfig.length === 0) {
        return { nextLevel: null, values: [] };
      }
      
      const nextLevel = hierarchyConfig[0];
      const uniqueValues = Array.from(new Set(
        data.map(row => row[nextLevel])
          .filter(val => val !== null && val !== undefined && val !== '')
          .map(val => String(val))
      )).sort();
      
      return { nextLevel, values: uniqueValues };
    }
    
    // Находим текущий максимальный уровень в иерархии
    let currentMaxIndex = -1;
    filterKeys.forEach(key => {
      const index = hierarchyConfig.indexOf(key);
      if (index > currentMaxIndex) {
        currentMaxIndex = index;
      }
    });
    
    // Если это последний уровень иерархии, возвращаем пустой результат
    if (currentMaxIndex === -1 || currentMaxIndex >= hierarchyConfig.length - 1) {
      return { nextLevel: null, values: [] };
    }
    
    const nextLevel = hierarchyConfig[currentMaxIndex + 1];
    
    // Применяем все текущие фильтры к данным
    let filteredData = data;
    
    // Применяем обычные фильтры
    if (parentGroup.filters.length > 0) {
      filteredData = applyFilters(filteredData, parentGroup.filters);
    }
    
    // Применяем иерархические фильтры
    filteredData = filteredData.filter(row => {
      return Object.entries(currentFilters).every(([level, value]) => {
        return String(row[level]) === String(value);
      });
    });
    
    // Получаем уникальные значения следующего уровня
    const values = Array.from(new Set(
      filteredData.map(row => row[nextLevel])
        .filter(val => val !== null && val !== undefined && val !== '')
        .map(val => String(val))
    )).sort();
    
    return { nextLevel, values };
  }, [parentGroup, hierarchyConfig, data]);
  
  // Мемоизируем результат для оптимизации
  const nextLevelInfo = useMemo(() => {
    return getNextLevelValues();
  }, [getNextLevelValues]);
  
  // Функция для создания подгрупп
  const createSubGroups = useCallback((
    selectedIndicators: string[],
    namePrefix?: string,
    includeFilters: boolean = true
  ) => {
    const { nextLevel, values } = nextLevelInfo;
    if (!nextLevel || values.length === 0) return [];
    
    // Фильтруем показатели по выбранным
    const indicatorsToInclude = parentGroup.indicators.filter(
      indicator => selectedIndicators.includes(indicator.name)
    );
    
    return values.map(value => {
      const subGroup: Omit<Group, 'id' | 'createdAt' | 'updatedAt'> = {
        name: `${namePrefix || parentGroup.name} - ${value}`,
        description: `Автосоздано из "${parentGroup.name}" для ${nextLevel}: ${value}`,
        hierarchyFilters: {
          ...parentGroup.hierarchyFilters,
          [nextLevel]: value
        },
        filters: includeFilters ? [...parentGroup.filters] : [],
        indicators: [...indicatorsToInclude]
      };
      
      return subGroup;
    });
  }, [parentGroup, nextLevelInfo]);
  
  // Проверяем, можно ли создать подгруппы
  const canCreateSubGroups = useMemo(() => {
    const { nextLevel, values } = nextLevelInfo;
    return nextLevel !== null && values.length > 0;
  }, [nextLevelInfo]);
  
  // Получаем информацию о количестве подгрупп
  const subGroupsCount = useMemo(() => {
    return nextLevelInfo.values.length;
  }, [nextLevelInfo]);
  
  // Получаем текущий уровень иерархии
  const getCurrentLevel = useCallback(() => {
    const currentFilters = parentGroup.hierarchyFilters || {};
    const filterKeys = Object.keys(currentFilters);
    
    if (filterKeys.length === 0) {
      return null;
    }
    
    // Находим максимальный уровень
    let maxIndex = -1;
    let currentLevel = null;
    
    filterKeys.forEach(key => {
      const index = hierarchyConfig.indexOf(key);
      if (index > maxIndex) {
        maxIndex = index;
        currentLevel = key;
      }
    });
    
    return currentLevel;
  }, [parentGroup, hierarchyConfig]);
  
  return {
    getNextLevelValues,
    createSubGroups,
    canCreateSubGroups,
    subGroupsCount,
    getCurrentLevel,
    nextLevel: nextLevelInfo.nextLevel,
    nextLevelValues: nextLevelInfo.values
  };
}