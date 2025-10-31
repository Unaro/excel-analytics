// src/lib/data-store.ts (рефакторинг под storage.ts ключи)
import { ExcelRow, FilterCondition, HierarchyFilters } from '@/types';
import { applyFilters, evaluateFormula } from './excel-parser';
import {
  getExcelData,         // читает excelAnalyticsData
  getGroups as storageGetGroups,
  saveGroups as storageSaveGroups,
  getIndicatorLibrary as storageGetIndicatorLibrary,
  saveIndicatorLibrary as storageSaveIndicatorLibrary,
} from './storage';

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

  private constructor() {}

  static getInstance(): DataStore {
    if (!DataStore.instance) {
      DataStore.instance = new DataStore();
    }
    return DataStore.instance;
  }

  // ==================== EXCEL DATA (read-only, через storage) ====================

  getRawData(): ExcelRow[] {
    try {
      const sheets = getExcelData(); // читает excelAnalyticsData из storage.ts
      if (!sheets || sheets.length === 0) return [];
      return sheets[0].rows;
    } catch (error) {
      console.error('Ошибка получения данных:', error);
      return [];
    }
  }

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

  hasData(): boolean {
    return this.getRawData().length > 0;
  }

  // ==================== GROUPS (через storage.ts API) ====================

  getGroups(): Group[] {
    try {
      const raw = storageGetGroups(); // строка или null
      return raw ? JSON.parse(raw) as Group[] : [];
    } catch (error) {
      console.error('Ошибка загрузки групп:', error);
      return [];
    }
  }

  getGroupById(id: string): Group | null {
    const groups = this.getGroups();
    return groups.find(g => g.id === id) || null;
    }

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
          filteredData = filteredData.filter(row => values.includes(String(row[column])));
        }
      });
    }

    // Вычисляем показатели
    const indicatorsWithValues: IndicatorWithValue[] = group.indicators.map(indicator => ({
      name: indicator.name,
      formula: indicator.formula,
      value: evaluateFormula(indicator.formula, filteredData, headers),
    }));

    return {
      ...group,
      rowCount: filteredData.length,
      indicators: indicatorsWithValues,
    };
  }

  getAllGroupsWithData(): GroupWithData[] {
    const groups = this.getGroups();
    return groups
      .map(g => this.getGroupWithData(g.id))
      .filter((g): g is GroupWithData => g !== null);
  }

  private persistGroups(groups: Group[]): void {
    try {
      storageSaveGroups(JSON.stringify(groups));
    } catch (error) {
      console.error('Ошибка сохранения групп:', error);
    }
  }

  createGroup(group: Omit<Group, 'id' | 'createdAt' | 'updatedAt'>): Group {
    const newGroup: Group = {
      ...group,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const groups = this.getGroups();
    groups.push(newGroup);
    this.persistGroups(groups);
    return newGroup;
  }

  updateGroup(id: string, updates: Partial<Omit<Group, 'id' | 'createdAt'>>): Group | null {
    const groups = this.getGroups();
    const index = groups.findIndex(g => g.id === id);
    if (index === -1) return null;

    groups[index] = {
      ...groups[index],
      ...updates,
      updatedAt: Date.now(),
    };
    this.persistGroups(groups);
    return groups[index];
  }

  deleteGroup(id: string): boolean {
    const groups = this.getGroups();
    const filtered = groups.filter(g => g.id !== id);
    if (filtered.length === groups.length) return false;
    this.persistGroups(filtered);
    return true;
  }

  clearAllGroups(): void {
    this.persistGroups([]);
  }

  // ==================== INDICATOR LIBRARY (через storage.ts API) ====================

  getIndicatorLibrary(): Indicator[] {
    try {
      const raw = storageGetIndicatorLibrary(); // строка или null
      return raw ? JSON.parse(raw) as Indicator[] : [];
    } catch (error) {
      console.error('Ошибка загрузки библиотеки показателей:', error);
      return [];
    }
  }

  private persistIndicatorLibrary(list: Indicator[]): void {
    try {
      storageSaveIndicatorLibrary(JSON.stringify(list));
    } catch (error) {
      console.error('Ошибка сохранения библиотеки показателей:', error);
    }
  }

  addIndicatorToLibrary(indicator: Indicator): void {
    const library = this.getIndicatorLibrary();
    library.push(indicator);
    this.persistIndicatorLibrary(library);
  }

  removeIndicatorFromLibrary(name: string): boolean {
    const library = this.getIndicatorLibrary();
    const filtered = library.filter(i => i.name !== name);
    if (filtered.length === library.length) return false;
    this.persistIndicatorLibrary(filtered);
    return true;
  }

  clearIndicatorLibrary(): void {
    this.persistIndicatorLibrary([]);
  }

  // ==================== ANALYTICS HELPERS ====================

  findCommonIndicators(groupIds: string[]): string[] {
    if (groupIds.length === 0) return [];
    const groups = groupIds
      .map(id => this.getGroupById(id))
      .filter((g): g is Group => g !== null);
    if (groups.length === 0) return [];

    const sets = groups.map(g => new Set(g.indicators.map(i => i.name)));
    return Array.from(sets[0]).filter(ind => sets.every(s => s.has(ind)));
  }

  getAllUniqueIndicators(groupIds: string[]): string[] {
    const groups = groupIds
      .map(id => this.getGroupById(id))
      .filter((g): g is Group => g !== null);
    const set = new Set<string>();
    groups.forEach(g => g.indicators.forEach(i => set.add(i.name)));
    return Array.from(set);
  }

  getComparisonData(groupIds: string[], indicatorName: string) {
    return groupIds
      .map(id => {
        const g = this.getGroupWithData(id);
        if (!g) return null;
        const ind = g.indicators.find(i => i.name === indicatorName);
        if (!ind) return null;
        return { name: g.name, value: ind.value, groupId: g.id };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }

  getSummaryData(groupIds?: string[]) {
    const groups = groupIds
      ? groupIds.map(id => this.getGroupWithData(id)).filter((g): g is GroupWithData => g !== null)
      : this.getAllGroupsWithData();

    return groups.map(g => ({
      groupId: g.id,
      groupName: g.name,
      indicators: g.indicators,
      rowCount: g.rowCount,
    }));
  }

  // ==================== MAINTENANCE ====================

  /**
   * Мягкая очистка доменов (не трогает другие ключи, полностью совместима со storage.ts)
   */
  clearAllData(): void {
    try {
      this.clearAllGroups();
      this.clearIndicatorLibrary();
      // Excel-данные очищаются через storage.clearExcelData() при необходимости — вызывать снаружи
    } catch (error) {
      console.error('Ошибка очистки доменных данных:', error);
    }
  }

  /**
   * Экспорт доменных данных (совместим со storage.ts)
   */
  exportData(): Record<string, unknown> {
    return {
      groups: this.getGroups(),
      indicatorLibrary: this.getIndicatorLibrary(),
      // Excel-данные экспортируй отдельно через storage.getExcelData()
    };
  }

  /**
   * Импорт доменных данных (совместим со storage.ts)
   */
  importData(data: Partial<{ groups: Group[]; indicatorLibrary: Indicator[] }>): void {
    if (data.groups) this.persistGroups(data.groups);
    if (data.indicatorLibrary) this.persistIndicatorLibrary(data.indicatorLibrary);
  }
}

// Экспорт singleton instance
export const dataStore = DataStore.getInstance();
