import { ExcelRow, FilterCondition, HierarchyFilters } from '@/types';
import { applyFilters, evaluateFormula } from './excel-parser';
import { getExcelData } from './storage';

// ==================== ТИПЫ ====================

export interface Indicator {
  name: string;
  formula: string;
  type?: 'standard' | 'aggregation' | 'custom';
  description?: string;
  tags?: string[];
  author?: string;
  checksum?: string;
}

export interface IndicatorWithValue extends Indicator {
  value: number;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  filters: FilterCondition[];
  hierarchyFilters?: HierarchyFilters;
  indicators: Indicator[];
  createdAt: number;
  updatedAt: number;
}

export interface GroupWithData extends Group {
  rowCount: number;
  indicators: IndicatorWithValue[];
}
// ==================== DATA STORE ====================

class DataStore {
  private static instance: DataStore;
  
  // Ключи для localStorage
  private readonly KEYS = {
    GROUPS: 'analyticsGroups',
    INDICATOR_LIBRARY: 'indicatorLibrary',
    EXCEL_DATA: 'uploadedExcelData',
    METADATA: 'datasetMetadata',
    DASHBOARDS: 'dashboards',
    SQL_QUERIES: 'savedSQLQueries',
  };

  private constructor() {}

  static getInstance(): DataStore {
    if (!DataStore.instance) {
      DataStore.instance = new DataStore();
    }
    return DataStore.instance;
  }

  // ==================== EXCEL DATA ====================

  /**
   * Получить сырые данные из Excel
   */
  getRawData(): ExcelRow[] {
    try {
      const sheets = getExcelData();
      if (!sheets || sheets.length === 0) return [];
      // Берем первый лист (или можно добавить параметр sheetIndex)
      return sheets[0].rows;
    } catch (error) {
      console.error('Ошибка получения данных:', error);
      return [];
    }
  }

  /**
   * Получить заголовки колонок
   */
  getHeaders(): string[] {
    try {
      const sheets = getExcelData();
      if (!sheets || sheets.length === 0) return [];
      return sheets[0].headers;
    } catch (error) {
      console.error('Ошибка получения заголовков:', error);
      return [];
    }
  }

  /**
   * Проверить наличие данных
   */
  hasData(): boolean {
    return this.getRawData().length > 0;
  }

  // ==================== GROUPS ====================

  /**
   * Получить все группы
   */
  getGroups(): Group[] {
    try {
      const data = localStorage.getItem(this.KEYS.GROUPS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Ошибка загрузки групп:', error);
      return [];
    }
  }

  /**
   * Получить группу по ID
   */
  getGroupById(id: string): Group | null {
    const groups = this.getGroups();
    return groups.find(g => g.id === id) || null;
  }

  /**
   * Получить группу с вычисленными данными
   */
  getGroupWithData(id: string): GroupWithData | null {
    const group = this.getGroupById(id);
    if (!group) return null;

    const rawData = this.getRawData();
    const headers = this.getHeaders();

    // Применяем фильтры
    let filteredData = applyFilters(rawData, group.filters);

    // Применяем иерархические фильтры
    if (group.hierarchyFilters) {
      Object.entries(group.hierarchyFilters).forEach(([column, values]) => {
        if (values && values.length > 0) {
          filteredData = filteredData.filter(row => 
            values.includes(String(row[column]))
          );
        }
      });
    }

    // Вычисляем показатели
    const indicatorsWithValues: IndicatorWithValue[] = group.indicators.map(indicator => ({
      name: indicator.name,
      formula: indicator.formula,
      value: evaluateFormula(indicator.formula, filteredData, headers)
    }));

    return {
      ...group,
      rowCount: filteredData.length,
      indicators: indicatorsWithValues
    };
  }

  /**
   * Получить все группы с данными
   */
  getAllGroupsWithData(): GroupWithData[] {
    const groups = this.getGroups();
    return groups
      .map(g => this.getGroupWithData(g.id))
      .filter((g): g is GroupWithData => g !== null);
  }

  /**
   * Сохранить группы
   */
  saveGroups(groups: Group[]): void {
    try {
      localStorage.setItem(this.KEYS.GROUPS, JSON.stringify(groups));
    } catch (error) {
      console.error('Ошибка сохранения групп:', error);
    }
  }

  /**
   * Создать группу
   */
  createGroup(group: Omit<Group, 'id' | 'createdAt' | 'updatedAt'>): Group {
    const newGroup: Group = {
      ...group,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    const groups = this.getGroups();
    groups.push(newGroup);
    this.saveGroups(groups);
    
    return newGroup;
  }

  /**
   * Обновить группу
   */
  updateGroup(id: string, updates: Partial<Omit<Group, 'id' | 'createdAt'>>): Group | null {
    const groups = this.getGroups();
    const index = groups.findIndex(g => g.id === id);
    
    if (index === -1) return null;
    
    groups[index] = {
      ...groups[index],
      ...updates,
      updatedAt: Date.now(),
    };
    
    this.saveGroups(groups);
    return groups[index];
  }

  /**
   * Удалить группу
   */
  deleteGroup(id: string): boolean {
    const groups = this.getGroups();
    const filtered = groups.filter(g => g.id !== id);
    
    if (filtered.length === groups.length) return false;
    
    this.saveGroups(filtered);
    return true;
  }

  // ==================== INDICATOR LIBRARY ====================

  /**
   * Получить библиотеку показателей
   */
  getIndicatorLibrary(): Indicator[] {
    try {
      const data = localStorage.getItem(this.KEYS.INDICATOR_LIBRARY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Ошибка загрузки библиотеки показателей:', error);
      return [];
    }
  }

  /**
   * Сохранить библиотеку показателей
   */
  saveIndicatorLibrary(indicators: Indicator[]): void {
    try {
      localStorage.setItem(this.KEYS.INDICATOR_LIBRARY, JSON.stringify(indicators));
    } catch (error) {
      console.error('Ошибка сохранения библиотеки показателей:', error);
    }
  }

  /**
   * Добавить показатель в библиотеку
   */
  addIndicatorToLibrary(indicator: Indicator): void {
    const library = this.getIndicatorLibrary();
    library.push(indicator);
    this.saveIndicatorLibrary(library);
  }

  /**
   * Удалить показатель из библиотеки
   */
  removeIndicatorFromLibrary(name: string): boolean {
    const library = this.getIndicatorLibrary();
    const filtered = library.filter(i => i.name !== name);
    
    if (filtered.length === library.length) return false;
    
    this.saveIndicatorLibrary(filtered);
    return true;
  }

  // ==================== COMMON INDICATORS ====================

  /**
   * Найти общие показатели между группами
   */
  findCommonIndicators(groupIds: string[]): string[] {
    if (groupIds.length === 0) return [];
    
    const groups = groupIds
      .map(id => this.getGroupById(id))
      .filter((g): g is Group => g !== null);
    
    if (groups.length === 0) return [];
    
    const indicatorSets = groups.map(g => 
      new Set(g.indicators.map(i => i.name))
    );
    
    return Array.from(indicatorSets[0]).filter(indicator =>
      indicatorSets.every(set => set.has(indicator))
    );
  }

  /**
   * Получить все уникальные показатели из групп
   */
  getAllUniqueIndicators(groupIds: string[]): string[] {
    const groups = groupIds
      .map(id => this.getGroupById(id))
      .filter((g): g is Group => g !== null);
    
    const indicatorSet = new Set<string>();
    groups.forEach(group => {
      group.indicators.forEach(ind => indicatorSet.add(ind.name));
    });
    
    return Array.from(indicatorSet);
  }

  // ==================== COMPARISON DATA ====================

  /**
   * Получить данные для сравнения групп по показателю
   */
  getComparisonData(groupIds: string[], indicatorName: string) {
    return groupIds
      .map(id => {
        const groupWithData = this.getGroupWithData(id);
        if (!groupWithData) return null;
        
        const indicator = groupWithData.indicators.find(i => i.name === indicatorName);
        if (!indicator) return null;
        
        return {
          name: groupWithData.name,
          value: indicator.value,
          groupId: groupWithData.id
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }

  // ==================== SUMMARY DATA ====================

  /**
   * Получить данные для сводной таблицы
   */
  getSummaryData(groupIds?: string[]) {
    const groups = groupIds 
      ? groupIds.map(id => this.getGroupWithData(id)).filter((g): g is GroupWithData => g !== null)
      : this.getAllGroupsWithData();
    
    return groups.map(group => ({
      groupId: group.id,
      groupName: group.name,
      indicators: group.indicators,
      rowCount: group.rowCount
    }));
  }

  // ==================== UTILITY ====================

  /**
   * Очистить все данные приложения
   */
  clearAllData(): void {
    Object.values(this.KEYS).forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error(`Ошибка очистки ${key}:`, error);
      }
    });
  }

  /**
   * Экспорт данных (для миграции)
   */
  exportData(): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    Object.entries(this.KEYS).forEach(([name, key]) => {
      try {
        const item = localStorage.getItem(key);
        data[name] = item ? JSON.parse(item) : null;
      } catch (error) {
        console.error(`Ошибка экспорта ${name}:`, error);
        data[name] = null;
      }
    });
    return data;
  }

  /**
   * Импорт данных (для миграции)
   */
  importData(data: Record<string, unknown>): void {
    Object.entries(data).forEach(([name, value]) => {
      const key = this.KEYS[name as keyof typeof this.KEYS];
      if (key && value !== null) {
        try {
          localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
          console.error(`Ошибка импорта ${name}:`, error);
        }
      }
    });
  }
}

// Экспорт singleton instance
export const dataStore = DataStore.getInstance();
