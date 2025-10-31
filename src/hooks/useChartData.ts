// src/hooks/useChartData.ts
import { useMemo } from 'react';
import { applyFilters, evaluateFormula } from '@/lib/excel-parser';
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
  // ---- Вспомогательные фильтры ----
  const applyDashboardFilters = useMemo(() => {
    return (data: ExcelRow[]): ExcelRow[] => {
      if (!dashboardFilters || dashboardFilters.length === 0) return data;
      return data.filter(row => {
        return dashboardFilters.every(filter => {
          const value = row[filter.column];
          if (filter.type === 'select' && filter.selectedValues?.length) {
            return filter.selectedValues.includes(String(value));
          }
          if (filter.type === 'multiselect' && filter.selectedValues?.length) {
            return filter.selectedValues.includes(String(value));
          }
          if (filter.type === 'range') {
            if (typeof value !== 'number') return true;
            if (filter.rangeMin != null && value < filter.rangeMin) return false;
            if (filter.rangeMax != null && value > filter.rangeMax) return false;
          }
          if (filter.type === 'date') {
            if (!value || typeof value === 'boolean') return true;
            const d = new Date(value);
            if (isNaN(d.getTime())) return true;
            if (filter.dateFrom && d < new Date(filter.dateFrom)) return false;
            if (filter.dateTo && d > new Date(filter.dateTo)) return false;
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

  const applyHierarchy = useMemo(() => {
    return (data: ExcelRow[]): ExcelRow[] => {
      if (!hierarchyFilters || Object.keys(hierarchyFilters).length === 0) return data;
      return data.filter(row => Object.entries(hierarchyFilters)
        .every(([col, val]) => String(row[col]) === String(val)));
    };
  }, [hierarchyFilters]);

  // ---- Базовые наборы данных ----
  const baseRows = useMemo(() => (sheets?.[0]?.rows ?? []), [sheets]);
  const baseFilteredData = useMemo(() => applyDashboardFilters(baseRows), [applyDashboardFilters, baseRows]);
  const hierarchyFilteredData = useMemo(() => applyHierarchy(baseFilteredData), [applyHierarchy, baseFilteredData]);

  // ---- Данные по группам ----
  const groupsData = useMemo(() => {
    if (!sheets?.length || !groups.length) return [] as Array<{
      id: string; name: string; indicators: string[]; data: { name: string; value: number }[]; rowCount: number;
    }>;

    return groups.map(group => {
      // выбрать самый глубокий иерархический фильтр из group.hierarchyFilters
      const getDeepestHierarchyFilter = (hf: Record<string, string> | undefined) => {
        if (!hf || !hierarchyConfig.length) return null;
        for (let i = hierarchyConfig.length - 1; i >= 0; i--) {
          const col = hierarchyConfig[i];
          if (hf[col]) return { column: col, value: hf[col] } as const;
        }
        return null;
      };

      const deepest = getDeepestHierarchyFilter((group as any).hierarchyFilters);
      const groupFilters = [
        ...(group.filters ?? []),
        ...(deepest ? [{ id: 'hier_deepest', column: deepest.column, operator: '=' as const, value: deepest.value }] : []),
      ];

      let rows = applyFilters(baseRows, groupFilters);
      rows = applyDashboardFilters(rows);

      const indicators = group.indicators.map(ind => {
        try {
          const v = evaluateFormula(ind.formula, rows, sheets[0].headers);
          return { name: ind.name, value: v };
        } catch {
          return { name: ind.name, value: 0 };
        }
      });

      return { id: group.id, name: group.name, indicators: group.indicators.map(i => i.name), data: indicators, rowCount: rows.length };
    });
  }, [sheets, groups, hierarchyConfig, applyDashboardFilters, baseRows]);

  // ---- Индикаторы библиотеки (по всем группам) ----
  const indicatorsLibrary = useMemo(() => {
    const map = new Map<string, string>();
    groups.forEach(g => g.indicators.forEach(ind => map.set(ind.name, ind.formula)));
    return map;
  }, [groups]);

  // Помощник: вычислить массив значений для выбранных индикаторов на основе набора строк
  const computeIndicators = (rows: ExcelRow[], indicatorNames: string[]): { name: string; value: number }[] => {
    return indicatorNames.map(name => {
      const formula = indicatorsLibrary.get(name);
      if (!formula) return { name, value: 0 };
      try {
        const v = evaluateFormula(formula, rows, sheets[0].headers);
        return { name, value: v };
      } catch {
        return { name, value: 0 };
      }
    });
  };

  // ---- Главная функция получения данных для графика ----
  const getChartData = useMemo(() => {
    return (config: ChartConfig): ChartDataPoint[] => {
      const useHierarchy = config.dataScope === 'hierarchy';

      // 1) Источник groups
      if (config.dataSource === 'groups' && config.groupIds?.length) {
        const selectedGroups = groupsData.filter(g => config.groupIds!.includes(g.id));
        const names = (config.indicators && config.indicators.length)
          ? config.indicators
          : (selectedGroups[0]?.indicators ?? []);

        return selectedGroups.map(g => {
          const row: ChartDataPoint = { name: g.name } as ChartDataPoint;
          names.forEach(ind => {
            const found = g.data.find(d => d.name === ind);
            row[ind] = found ? found.value : 0;
          });
          return row;
        });
      }

      // 2) Источник raw (без групп) — ДОЛЖЕН РАБОТАТЬ ДЛЯ ВСЕХ ТИПОВ
      if (config.dataSource === 'raw' || !config.groupIds?.length) {
        // База строк для вычисления показателей: учитываем иерархию или нет
        const rows = useHierarchy ? hierarchyFilteredData : baseFilteredData;

        // Если индикаторы заданы в конфиге — используем их. Иначе берём все из библиотеки
        const names = (config.indicators && config.indicators.length)
          ? config.indicators
          : Array.from(indicatorsLibrary.keys());

        const computed = computeIndicators(rows, names);

        // Возвращаем данные в формате: [{ name: indicatorName, value: number } | многомерно]
        // Для унификации отдадим как массив точек, где name — это название показателя, value — значение
        return computed.map(ind => ({ name: ind.name, value: ind.value } as ChartDataPoint));
      }

      // Fallback
      return [];
    };
  }, [groupsData, baseFilteredData, hierarchyFilteredData, indicatorsLibrary]);

  // ---- API ----
  const getAvailableIndicators = useMemo(() => {
    return (selectedGroupIds?: string[]): string[] => {
      if (!selectedGroupIds || selectedGroupIds.length === 0) {
        return Array.from(indicatorsLibrary.keys()).sort();
      }
      const selected = groups.filter(g => selectedGroupIds.includes(g.id));
      if (selected.length === 0) return [];
      if (selected.length === 1) return selected[0].indicators.map(i => i.name).sort();
      const first = selected[0].indicators.map(i => i.name);
      return first.filter(ind => selected.every(g => g.indicators.some(i => i.name === ind))).sort();
    };
  }, [groups, indicatorsLibrary]);

  const availableIndicators = useMemo(() => getAvailableIndicators(), [getAvailableIndicators]);

  const filterStats = useMemo(() => {
    const totalRows = baseRows.length;
    const baseFilteredRows = baseFilteredData.length;
    const hierarchyFilteredRows = hierarchyFilteredData.length;
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
    } as const;
  }, [baseRows, baseFilteredData, hierarchyFilteredData, hierarchyFilters, dashboardFilters]);

  return {
    // Наборы данных
    filteredData: hierarchyFilteredData,
    baseFilteredData,
    groupsData,
    // Функции
    getChartData,
    getAvailableIndicators,
    // Метаданные
    availableIndicators,
    filterStats,
  };
}
