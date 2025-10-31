// src/hooks/useChartData.ts
import { useMemo } from 'react';
import { applyFilters, evaluateFormula } from '@/lib/excel-parser';
import { dataStore } from '@/lib/data-store';
import type { ExcelRow, HierarchyFilters } from '@/types';
import type { ChartConfig, DashboardFilter } from '@/types/dashboard-builder';
import type { ChartDataPoint } from '@/types/dashboard';
import type { Group } from '@/lib/data-store';

interface UseChartDataProps {
  sheets: Array<{ headers: string[]; rows: ExcelRow[] }>;
  groups: Group[];
  hierarchyConfig: string[];
  hierarchyFilters: HierarchyFilters;
  dashboardFilters: DashboardFilter[];
}

export function useChartData({
  sheets,
  groups,
  hierarchyConfig,
  hierarchyFilters,
  dashboardFilters,
}: UseChartDataProps) {
  
  // Применяем фильтры дашборда к данным
  const applyDashboardFilters = useMemo(() => {
    return (data: ExcelRow[]): ExcelRow[] => {
      if (!dashboardFilters || dashboardFilters.length === 0) return data;

      return data.filter(row => {
        return dashboardFilters.every(filter => {
          const value = row[filter.column];

          // SELECT фильтр
          if (filter.type === 'select' && filter.selectedValues && filter.selectedValues.length > 0) {
            return filter.selectedValues.includes(String(value));
          }

          // MULTISELECT фильтр
          if (filter.type === 'multiselect' && filter.selectedValues && filter.selectedValues.length > 0) {
            return filter.selectedValues.includes(String(value));
          }

          // RANGE фильтр
          if (filter.type === 'range') {
            if (typeof value !== 'number') return true;
            if (filter.rangeMin != null && value < filter.rangeMin) return false;
            if (filter.rangeMax != null && value > filter.rangeMax) return false;
          }

          // DATE фильтр
          if (filter.type === 'date') {
            if (!value || typeof value === 'boolean') return true;
            
            const dateValue = new Date(value);
            if (isNaN(dateValue.getTime())) return true;
            if (filter.dateFrom && dateValue < new Date(filter.dateFrom)) return false;
            if (filter.dateTo && dateValue > new Date(filter.dateTo)) return false;
          }

          // SEARCH фильтр
          if (filter.type === 'search' && filter.searchTerm) {
            if (!value) return false;
            return String(value).toLowerCase().includes(filter.searchTerm.toLowerCase());
          }

          return true;
        });
      });
    };
  }, [dashboardFilters]);
  
  // Применяем иерархические фильтры
  const applyHierarchyFilters = useMemo(() => {
    return (data: ExcelRow[]): ExcelRow[] => {
      if (!hierarchyFilters || Object.keys(hierarchyFilters).length === 0) return data;
      
      return data.filter(row => {
        return Object.entries(hierarchyFilters).every(([level, value]) => {
          return String(row[level]) === String(value);
        });
      });
    };
  }, [hierarchyFilters]);
  
  // Получение отфильтрованных данных
  const filteredData = useMemo(() => {
    if (!sheets || sheets.length === 0) return [];
    
    let data = sheets[0].rows;
    
    // Применяем фильтры в порядке: сначала иерархические, потом остальные
    data = applyHierarchyFilters(data);
    data = applyDashboardFilters(data);
    
    return data;
  }, [sheets, applyHierarchyFilters, applyDashboardFilters]);
  
  // Вычисление данных для групп с учетом фильтров
  const groupsData = useMemo(() => {
    if (!sheets || sheets.length === 0 || groups.length === 0) return [];

    return groups.map(group => {
      // Получаем самый глубокий фильтр из иерархических
      const getDeepestHierarchyFilter = (hierarchyFilters: Record<string, string> | undefined) => {
        if (!hierarchyFilters || !hierarchyConfig.length) return null;
        
        let deepestLevel = null;
        for (let i = hierarchyConfig.length - 1; i >= 0; i--) {
          const col = hierarchyConfig[i];
          if (hierarchyFilters[col]) {
            deepestLevel = { column: col, value: hierarchyFilters[col] };
            break;
          }
        }
        return deepestLevel;
      };

      const deepestFilter = getDeepestHierarchyFilter(group.hierarchyFilters);
      
      // Создаем массив всех фильтров группы
      const groupFilters = [
        ...group.filters,
        ...(deepestFilter ? [{
          id: 'hier_deepest',
          column: deepestFilter.column,
          operator: '=' as const,
          value: deepestFilter.value,
        }] : []),
      ];

      // Применяем фильтры группы
      let groupData = applyFilters(sheets[0].rows, groupFilters);
      
      // Применяем дашбордные фильтры (но не иерархические)
      groupData = applyDashboardFilters(groupData);

      // Вычисляем показатели
      const indicators = group.indicators.map(indicator => {
        try {
          const value = evaluateFormula(indicator.formula, groupData, sheets[0].headers);
          return { name: indicator.name, value };
        } catch {
          return { name: indicator.name, value: 0 };
        }
      });

      return {
        id: group.id,
        name: group.name,
        indicators: group.indicators.map(i => i.name),
        data: indicators,
        rowCount: groupData.length,
      };
    });
  }, [sheets, groups, hierarchyConfig, applyDashboardFilters]);
  
  // Глобальные показатели (без групп)
  const globalIndicators = useMemo(() => {
    if (!sheets || sheets.length === 0) return [];
    
    // Получаем все уникальные показатели из всех групп
    const allIndicators = new Map<string, string>(); // name -> formula
    
    groups.forEach(group => {
      group.indicators.forEach(indicator => {
        allIndicators.set(indicator.name, indicator.formula);
      });
    });
    
    // Вычисляем показатели на основе отфильтрованных данных
    const indicators = Array.from(allIndicators.entries()).map(([name, formula]) => {
      try {
        const value = evaluateFormula(formula, filteredData, sheets[0].headers);
        return { name, value };
      } catch {
        return { name, value: 0 };
      }
    });
    
    return indicators;
  }, [sheets, groups, filteredData]);
  
  // Функция для получения данных для конкретного графика
  const getChartData = useMemo(() => {
    return (config: ChartConfig): ChartDataPoint[] => {
      if (config.dataSource === 'groups' && config.groupIds && config.groupIds.length > 0) {
        // Данные из выбранных групп
        const selectedGroups = groupsData.filter(g => config.groupIds!.includes(g.id));
        
        if (config.indicators && config.indicators.length > 0) {
          // Много показателей - создаем мульти-серийные данные
          return selectedGroups.map(group => {
            const result: ChartDataPoint = { name: group.name };
            config.indicators!.forEach(indicatorName => {
              const indicator = group.data.find(d => d.name === indicatorName);
              result[indicatorName] = indicator ? indicator.value : 0;
            });
            return result;
          });
        } else {
          // Один показатель - используем первый доступный
          return selectedGroups.map(group => ({
            name: group.name,
            value: group.data[0]?.value || 0,
          }));
        }
      } else if (config.dataSource === 'raw' || !config.groupIds || config.groupIds.length === 0) {
        // Глобальные показатели по всем данным
        if (config.indicators && config.indicators.length > 0) {
          return config.indicators.map(indicatorName => {
            const indicator = globalIndicators.find(i => i.name === indicatorName);
            return {
              name: indicatorName,
              value: indicator ? indicator.value : 0,
            };
          });
        } else {
          return globalIndicators.map(indicator => ({
            name: indicator.name,
            value: indicator.value,
          }));
        }
      }
      
      return [];
    };
  }, [groupsData, globalIndicators]);
  
  // Получение доступных показателей
  const availableIndicators = useMemo(() => {
    const indicators = new Set<string>();
    
    groups.forEach(group => {
      group.indicators.forEach(indicator => {
        indicators.add(indicator.name);
      });
    });
    
    return Array.from(indicators).sort();
  }, [groups]);
  
  // Статистика по фильтрации
  const filterStats = useMemo(() => {
    const totalRows = sheets?.[0]?.rows.length || 0;
    const filteredRows = filteredData.length;
    const filterPercentage = totalRows > 0 ? Math.round((filteredRows / totalRows) * 100) : 0;
    
    return {
      totalRows,
      filteredRows,
      filterPercentage,
      hasFilters: Object.keys(hierarchyFilters).length > 0 || dashboardFilters.some(f => 
        (f.selectedValues && f.selectedValues.length > 0) ||
        f.rangeMin != null || f.rangeMax != null ||
        f.dateFrom || f.dateTo || f.searchTerm
      ),
    };
  }, [sheets, filteredData, hierarchyFilters, dashboardFilters]);
  
  return {
    // Обработанные данные
    filteredData,
    groupsData,
    globalIndicators,
    
    // Функции для графиков
    getChartData,
    
    // Метаданные
    availableIndicators,
    filterStats,
  };
}