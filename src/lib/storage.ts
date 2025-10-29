import { SheetData } from '@/types';

const STORAGE_KEY = 'uploadedExcelData';

export function saveExcelData(data: SheetData[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Ошибка сохранения данных:', error);
  }
}

export function getExcelData(): SheetData[] | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Ошибка загрузки данных:', error);
    return null;
  }
}

export function clearExcelData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Ошибка очистки данных:', error);
  }
}

export const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];