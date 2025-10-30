/**
 * Хранилище для конфигурации иерархии
 * Сохраняет массив колонок в порядке иерархии
 */

const HIERARCHY_CONFIG_KEY = 'hierarchyConfig';

export function getHierarchyConfig(): string[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const data = localStorage.getItem(HIERARCHY_CONFIG_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Ошибка загрузки конфигурации иерархии:', error);
    return [];
  }
}

export function saveHierarchyConfig(config: string[]): void {
  if (typeof window === 'undefined') {
    console.warn('localStorage недоступен');
    return;
  }
  
  try {
    localStorage.setItem(HIERARCHY_CONFIG_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Ошибка сохранения конфигурации иерархии:', error);
  }
}

export function clearHierarchyConfig(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(HIERARCHY_CONFIG_KEY);
  } catch (error) {
    console.error('Ошибка очистки конфигурации иерархии:', error);
  }
}
