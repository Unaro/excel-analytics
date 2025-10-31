// src/lib/storage.ts
import type { SheetData } from '@/types';

const STORAGE_KEY = 'excelAnalyticsData';
const GROUPS_KEY = 'analyticsGroups';
const INDICATOR_LIBRARY_KEY = 'indicatorLibrary';
const DASHBOARDS_KEY = 'dashboards';

/**
 * Проверка доступности localStorage (защита от SSR)
 */
function isLocalStorageAvailable(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

export function getExcelData(): SheetData[] | null {
  if (!isLocalStorageAvailable()) return null;
  
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Ошибка загрузки данных:', error);
    return null;
  }
}

export function saveExcelData(data: SheetData[]): void {
  if (!isLocalStorageAvailable()) {
    console.warn('localStorage недоступен');
    return;
  }
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Ошибка сохранения данных:', error);
  }
}

export function clearExcelData(): void {
  if (!isLocalStorageAvailable()) return;
  
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Ошибка очистки данных:', error);
  }
}

// Группы

export function getGroups(): string | null {
  if (!isLocalStorageAvailable()) return null;
  return localStorage.getItem(GROUPS_KEY);
}

export function saveGroups(data: string): void {
  if (!isLocalStorageAvailable()) return;
  localStorage.setItem(GROUPS_KEY, data);
}

export function clearGroups(): void {
  if (!isLocalStorageAvailable()) return;
  try {
    localStorage.removeItem(GROUPS_KEY);
  } catch (error) {
    console.error('Ошибка очистки групп:', error);
  }
}

// Библиотека индикаторов

export function getIndicatorLibrary(): string | null {
  if (!isLocalStorageAvailable()) return null;
  return localStorage.getItem(INDICATOR_LIBRARY_KEY);
}

export function saveIndicatorLibrary(data: string): void {
  if (!isLocalStorageAvailable()) return;
  localStorage.setItem(INDICATOR_LIBRARY_KEY, data);
}

export function clearIndicatorLibrary(): void {
  if (!isLocalStorageAvailable()) return;
  try {
    localStorage.removeItem(INDICATOR_LIBRARY_KEY);
  } catch (error) {
    console.error('Ошибка очистки библиотеки показателей:', error);
  }
}

// Дашборды

export function getDashboards(): string | null {
  if (!isLocalStorageAvailable()) return null;
  return localStorage.getItem(DASHBOARDS_KEY);
}

export function saveDashboards(data: string): void {
  if (!isLocalStorageAvailable()) return;
  localStorage.setItem(DASHBOARDS_KEY, data);
}

export function clearDashboards(): void {
  if (!isLocalStorageAvailable()) return;
  try {
    localStorage.removeItem(DASHBOARDS_KEY);
  } catch (error) {
    console.error('Ошибка очистки дашбордов:', error);
  }
}

// Палитра для графиков

export const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
