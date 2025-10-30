import { useState, useEffect, useCallback } from 'react';
import { getHierarchyConfig, saveHierarchyConfig } from '@/lib/hierarchy-store';

export function useHierarchy() {
  const [config, setConfig] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Загружаем конфиг при монтировании
  useEffect(() => {
    setLoading(true);
    const loaded = getHierarchyConfig();
    setConfig(loaded);
    setLoading(false);
  }, []);

  // Сохраняем конфиг
  const saveConfig = useCallback((newConfig: string[]) => {
    setConfig(newConfig);
    saveHierarchyConfig(newConfig);
  }, []);

  // Добавляем колонку
  const addColumn = useCallback((column: string) => {
    if (!config.includes(column)) {
      const newConfig = [...config, column];
      saveConfig(newConfig);
    }
  }, [config, saveConfig]);

  // Удаляем колонку
  const removeColumn = useCallback((column: string) => {
    const newConfig = config.filter(c => c !== column);
    saveConfig(newConfig);
  }, [config, saveConfig]);

  // Перемещаем колонку
  const moveColumn = useCallback((fromIndex: number, toIndex: number) => {
    const newConfig = [...config];
    const [removed] = newConfig.splice(fromIndex, 1);
    newConfig.splice(toIndex, 0, removed);
    saveConfig(newConfig);
  }, [config, saveConfig]);

  // Очищаем конфиг
  const clearConfig = useCallback(() => {
    setConfig([]);
    localStorage.removeItem('hierarchyConfig');
  }, []);

  return {
    config,
    loading,
    saveConfig,
    addColumn,
    removeColumn,
    moveColumn,
    clearConfig,
  };
}
