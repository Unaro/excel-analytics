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

          if (filter.type === 'select' && filter.selectedValues && filter.selectedValues.length > 0) {
            return filter.selectedValues.includes(String(value));
          }

          if (filter.type === 'multiselect' && filter.selectedValues && filter.selectedValues.length > 0) {
            return filter.selectedValues.includes(String(value));
          }

          if (filter.type === 'range') {
            if (typeof value !== 'number') return true;
            if (filter.rangeMin != null && value < filter.rangeMin) return false;
            if (filter.rangeMax != null && value > filter.rangeMax) return false;
          }

          if (filter.type === 'date') {
            if (!value || typeof value === 'boolean') return true;
            
            const dateValue = new Date(value);
            if (isNaN(dateValue.getTime())) return true;
            if (filter.dateFrom && dateValue < new Date(filter.dateFrom)) return false;
            if (filter.dateTo && dateValue > new Date(filter.dateTo)) return false;
          }

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
  
  // Получаем базовые данные с учётом фильтров дашборда
  const baseFilteredData = useMemo(() => {
    if (!sheets || sheets.length === 0) return [];
    return applyDashboardFilters(sheets[0].rows);
  }, [sheets, applyDashboardFilters]);
  
  // Получаем данные с учётом всех фильтров (для совместимости)
  const filteredData = useMemo(() => {
    return applyHierarchyFilters(baseFilteredData);
  }, [baseFilteredData, applyHierarchyFilters]);
  
  // Вычисление данных для групп с учетом фильтров
  const groupsData = useMemo(() => {
    if (!sheets || sheets.length === 0 || groups.length === 0) return [];

    return groups.map(group => {
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
      
      const groupFilters = [
        ...group.filters,
        ...(deepestFilter ? [{
          id: 'hier_deepest',
          column: deepestFilter.column,
          operator: '=' as const,
          value: deepestFilter.value,
        }] : []),
      ];

      let groupData = applyFilters(sheets[0].rows, groupFilters);
      groupData = applyDashboardFilters(groupData);

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
  
  // Глобальные показатели с учётом иерархических фильтров
  const globalIndicators = useMemo(() => {
    if (!sheets || sheets.length === 0) return [];
    
    const allIndicators = new Map<string, string>();
    groups.forEach(group => {
      group.indicators.forEach(indicator => {
        allIndicators.set(indicator.name, indicator.formula);
      });
    });
    
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
  
  // Глобальные показатели без иерархических фильтров
  const pureGlobalIndicators = useMemo(() => {
    if (!sheets || sheets.length === 0) return [];
    
    const allIndicators = new Map<string, string>();
    groups.forEach(group => {
      group.indicators.forEach(indicator => {
        allIndicators.set(indicator.name, indicator.formula);
      });
    });
    
    const indicators = Array.from(allIndicators.entries()).map(([name, formula]) => {
      try {
        const value = evaluateFormula(formula, baseFilteredData, sheets[0].headers);
        return { name, value };
      } catch {
        return { name, value: 0 };
      }
    });
    
    return indicators;
  }, [sheets, groups, baseFilteredData]);
  
  // Функция для получения данных для конкретного графика
  const getChartData = useMemo(() => {
    return (config: ChartConfig): ChartDataPoint[] => {
      // Определяем область данных
      const useHierarchyFiltering = config.dataScope === 'hierarchy';
      
      if (config.dataSource === 'groups' && config.groupIds && config.groupIds.length > 0) {
        // Данные из выбранных групп
        const selectedGroups = groupsData.filter(g => config.groupIds!.includes(g.id));
        
        if (config.indicators && config.indicators.length > 0) {
          return selectedGroups.map(group => {
            const result: ChartDataPoint = { name: group.name };
            config.indicators!.forEach(indicatorName => {
              const indicator = group.data.find(d => d.name === indicatorName);
              result[indicatorName] = indicator ? indicator.value : 0;
            });
            return result;
          });
        } else {
          return selectedGroups.map(group => ({
            name: group.name,
            value: group.data[0]?.value || 0,
          }));
        }
      } else {
        // Глобальные показатели
        const sourceIndicators = useHierarchyFiltering ? globalIndicators : pureGlobalIndicators;
        
        if (config.indicators && config.indicators.length > 0) {
          return config.indicators.map(indicatorName => {
            const indicator = sourceIndicators.find(i => i.name === indicatorName);
            return {
              name: indicatorName,
              value: indicator ? indicator.value : 0,
            };
          });
        } else {
          return sourceIndicators.map(indicator => ({
            name: indicator.name,
            value: indicator.value,
          }));
        }
      }
    };
  }, [groupsData, globalIndicators, pureGlobalIndicators]);
  
  // Получение доступных показателей для выбранных групп
  const getAvailableIndicators = useMemo(() => {
    return (selectedGroupIds?: string[]): string[] => {
      if (!selectedGroupIds || selectedGroupIds.length === 0) {
        // Если группы не выбраны, возвращаем все показатели из библиотеки
        const allIndicators = new Set<string>();
        groups.forEach(group => {
          group.indicators.forEach(indicator => {
            allIndicators.add(indicator.name);
          });
        });
        return Array.from(allIndicators).sort();
      }
      
      // Находим общие показатели для выбранных групп
      const selectedGroups = groups.filter(g => selectedGroupIds.includes(g.id));
      
      if (selectedGroups.length === 0) return [];
      if (selectedGroups.length === 1) {
        return selectedGroups[0].indicators.map(i => i.name).sort();
      }
      
      // Находим пересечение показателей
      const firstGroupIndicators = selectedGroups[0].indicators.map(i => i.name);
      const commonIndicators = firstGroupIndicators.filter(indicator =>
        selectedGroups.every(group => 
          group.indicators.some(i => i.name === indicator)
        )
      );
      
      return commonIndicators.sort();
    };
  }, [groups]);
  
  // Получение всех доступных показателей
  const availableIndicators = useMemo(() => {
    return getAvailableIndicators();
  }, [getAvailableIndicators]);
  
  // Статистика по фильтрации
  const filterStats = useMemo(() => {
    const totalRows = sheets?.[0]?.rows.length || 0;
    const baseFilteredRows = baseFilteredData.length;
    const hierarchyFilteredRows = filteredData.length;
    
    return {
      totalRows,
      filteredRows: hierarchyFilteredRows,
      baseFilteredRows,
      filterPercentage: totalRows > 0 ? Math.round((hierarchyFilteredRows / totalRows) * 100) : 0,
      hasFilters: Object.keys(hierarchyFilters).length > 0 || dashboardFilters.some(f => 
        (f.selectedValues && f.selectedValues.length > 0) ||
        f.rangeMin != null || f.rangeMax != null ||
        f.dateFrom || f.dateTo || f.searchTerm
      ),
      hasDashboardFilters: dashboardFilters.some(f => 
        (f.selectedValues && f.selectedValues.length > 0) ||
        f.rangeMin != null || f.rangeMax != null ||
        f.dateFrom || f.dateTo || f.searchTerm
      ),
      hasHierarchyFilters: Object.keys(hierarchyFilters).length > 0,
    };
  }, [sheets, baseFilteredData, filteredData, hierarchyFilters, dashboardFilters]);
  
  return {
    // Обработанные данные
    filteredData,
    baseFilteredData,
    groupsData,
    globalIndicators,
    pureGlobalIndicators,
    
    // Функции для графиков
    getChartData,
    getAvailableIndicators,
    
    // Метаданные
    availableIndicators,
    filterStats,
  };
}