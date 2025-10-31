// src/lib/utils.ts (обновленная версия)
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Безопасный парсинг JSON с fallback
 */
export function safeParse<T = unknown>(str: string | null, fallback: T | null = null): T | null {
  if (!str) return fallback;
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

/**
 * Склонение русских слов по числительным
 */
export function pluralizeRU(count: number, forms: [string, string, string]): string {
  const [one, few, many] = forms;
  
  if (count === 0) return `0 ${many}`;
  if (count === 1) return `1 ${one}`;
  
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return `${count} ${many}`;
  }
  
  if (lastDigit === 1) return `${count} ${one}`;
  if (lastDigit >= 2 && lastDigit <= 4) return `${count} ${few}`;
  return `${count} ${many}`;
}

/**
 * Форматирование статуса данных
 */
export function formatDataStatus(data: unknown, emptyText = 'Нет'): string {
  if (!data) return `✗ ${emptyText}`;
  
  if (Array.isArray(data)) {
    const count = data.length;
    return count > 0 ? `✓ ${count}` : `✗ ${emptyText}`;
  }
  
  return `✓ Есть`;
}

/**
 * Форматирование статуса с единицами измерения
 */
export function formatDataStatusWithUnits(
  data: unknown, 
  units: [string, string, string], 
  emptyText = 'Нет'
): string {
  if (!data) return `✗ ${emptyText}`;
  
  if (Array.isArray(data)) {
    const count = data.length;
    return count > 0 ? `✓ ${pluralizeRU(count, units)}` : `✗ ${emptyText}`;
  }
  
  return `✓ Настроено`;
}

/**
 * Проверка доступности localStorage
 */
export function isStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Безопасное получение значения из localStorage
 */
export function getStorageItem<T = unknown>(key: string, fallback: T | null = null): T | null {
  if (!isStorageAvailable()) return fallback;
  
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Безопасное сохранение в localStorage
 */
export function setStorageItem(key: string, value: unknown): boolean {
  if (!isStorageAvailable()) return false;
  
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Безопасное удаление из localStorage
 */
export function removeStorageItem(key: string): boolean {
  if (!isStorageAvailable()) return false;
  
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
