// src/lib/cleanup.ts (обновленная версия)
import { dataStore } from './data-store';
import { 
  clearExcelData, 
  clearGroups, 
  clearIndicatorLibrary, 
  clearDashboards 
} from './storage';
import { clearFieldTypes } from './field-type-store';
import { removeStorageItem } from './utils';

/**
 * Очистка загруженных Excel/CSV данных
 */
export function clearUploadedData(): void {
  try {
    // Очищаем через dataStore (внутренние структуры)
    dataStore.clearAllData();
  } catch (error) {
    console.warn('Ошибка очистки dataStore:', error);
  }
  
  // Очищаем основное хранилище Excel данных
  clearExcelData();
}

/**
 * Очистка групп показателей
 */
export function clearAnalyticsGroups(): void {
  try {
    // Очищаем через dataStore (внутренние структуры)
    dataStore.clearAllGroups();
  } catch (error) {
    console.warn('Ошибка очистки групп в dataStore:', error);
  }
  
  // Очищаем основное хранилище групп
  clearGroups();
}

/**
 * Очистка библиотеки индикаторов
 */
export function clearIndicatorsLibrary(): void {
  try {
    // Очищаем через dataStore (внутренние структуры)
    dataStore.clearIndicatorLibrary();
  } catch (error) {
    console.warn('Ошибка очистки библиотеки в dataStore:', error);
  }
  
  // Очищаем основное хранилище библиотеки
  clearIndicatorLibrary();
}

/**
 * Очистка дашбордов
 */
export function clearDashboardsData(): void {
  // Очищаем дашборды через storage API
  clearDashboards();
}

/**
 * Очистка конфигурации иерархии
 */
export function clearHierarchyConfig(): void {
  // TODO: Добавить API в hierarchy-store для clear()
  removeStorageItem('hierarchyConfig');
}

/**
 * Очистка типов полей
 */
export function clearFieldTypesData(): void {
  try {
    clearFieldTypes();
  } catch (error) {
    console.warn('Ошибка очистки типов полей:', error);
  }
  
  // Дополнительная очистка ключа на случай если clearFieldTypes не удаляет его
  removeStorageItem('fieldTypes');
}

/**
 * Полная очистка всех данных приложения
 */
export function clearAllData(): void {
  clearUploadedData();
  clearAnalyticsGroups();
  clearIndicatorsLibrary();
  clearDashboardsData();
  clearHierarchyConfig();
  clearFieldTypesData();
}

/**
 * Получение статуса всех типов данных
 */
export function getDataStatus() {
  if (typeof window === 'undefined') {
    return {
      excelAnalyticsData: null,
      analyticsGroups: null,
      indicatorLibrary: null,
      dashboards: null,
      hierarchyConfig: null,
      fieldTypes: null,
    };
  }
  
  return {
    excelAnalyticsData: localStorage.getItem('excelAnalyticsData'),
    analyticsGroups: localStorage.getItem('analyticsGroups'),
    indicatorLibrary: localStorage.getItem('indicatorLibrary'),
    dashboards: localStorage.getItem('dashboards'),
    hierarchyConfig: localStorage.getItem('hierarchyConfig'),
    fieldTypes: localStorage.getItem('fieldTypes'),
  };
}
