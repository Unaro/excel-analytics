// src/hooks/useDashboardManager.ts
import { useState, useEffect, useCallback } from 'react';
import { getDashboards, saveDashboards } from '@/lib/storage';
import type { Dashboard, ChartConfig, DashboardFilter } from '@/types/dashboard-builder';

export function useDashboardManager() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [currentDashboard, setCurrentDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Загрузка дашбордов
  useEffect(() => {
    try {
      const saved = getDashboards();
      if (saved) {
        const parsed: Dashboard[] = JSON.parse(saved);
        setDashboards(parsed);
        if (parsed.length > 0) {
          setCurrentDashboard(parsed[0]);
        }
      }
    } catch (err) {
      console.error('Ошибка загрузки дашбордов:', err);
      setError('Ошибка загрузки дашбордов');
    } finally {
      setLoading(false);
    }
  }, []);

  // Сохранение дашбордов
  const persistDashboards = useCallback((newDashboards: Dashboard[]) => {
    try {
      saveDashboards(JSON.stringify(newDashboards));
      setDashboards(newDashboards);
      setError(null);
    } catch (err) {
      console.error('Ошибка сохранения дашбордов:', err);
      setError('Ошибка сохранения');
    }
  }, []);

  // Создание нового дашборда
  const createDashboard = useCallback((name: string) => {
    const newDashboard: Dashboard = {
      id: Date.now().toString(),
      name,
      description: '',
      charts: [],
      filters: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const updated = [...dashboards, newDashboard];
    persistDashboards(updated);
    setCurrentDashboard(newDashboard);
    
    return newDashboard;
  }, [dashboards, persistDashboards]);

  // Обновление дашборда
  const updateDashboard = useCallback((id: string, updates: Partial<Dashboard>) => {
    const updatedDashboard = {
      ...dashboards.find(d => d.id === id),
      ...updates,
      id, // Обеспечиваем, что ID не изменяется
      updatedAt: Date.now(),
    } as Dashboard;

    const updated = dashboards.map(d => d.id === id ? updatedDashboard : d);
    persistDashboards(updated);
    
    if (currentDashboard?.id === id) {
      setCurrentDashboard(updatedDashboard);
    }
    
    return updatedDashboard;
  }, [dashboards, currentDashboard, persistDashboards]);

  // Удаление дашборда
  const deleteDashboard = useCallback((id: string) => {
    const updated = dashboards.filter(d => d.id !== id);
    persistDashboards(updated);
    
    if (currentDashboard?.id === id) {
      setCurrentDashboard(updated.length > 0 ? updated[0] : null);
    }
  }, [dashboards, currentDashboard, persistDashboards]);

  // Дублирование дашборда
  const duplicateDashboard = useCallback((id: string) => {
    const original = dashboards.find(d => d.id === id);
    if (!original) return null;

    const duplicate: Dashboard = {
      ...original,
      id: Date.now().toString(),
      name: `${original.name} (копия)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      charts: original.charts.map(chart => ({
        ...chart,
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      })),
    };

    const updated = [...dashboards, duplicate];
    persistDashboards(updated);
    setCurrentDashboard(duplicate);
    
    return duplicate;
  }, [dashboards, persistDashboards]);

  // Добавление/обновление графика
  const saveChart = useCallback((chart: ChartConfig) => {
    if (!currentDashboard) return;

    const existingIndex = currentDashboard.charts.findIndex(c => c.id === chart.id);
    const updatedCharts = existingIndex >= 0
      ? currentDashboard.charts.map(c => c.id === chart.id ? chart : c)
      : [...currentDashboard.charts, chart];

    updateDashboard(currentDashboard.id, { charts: updatedCharts });
  }, [currentDashboard, updateDashboard]);

  // Удаление графика
  const deleteChart = useCallback((chartId: string) => {
    if (!currentDashboard) return;

    const updatedCharts = currentDashboard.charts.filter(c => c.id !== chartId);
    updateDashboard(currentDashboard.id, { charts: updatedCharts });
  }, [currentDashboard, updateDashboard]);

  // Обновление фильтров дашборда
  const updateFilters = useCallback((filters: DashboardFilter[]) => {
    if (!currentDashboard) return;
    updateDashboard(currentDashboard.id, { filters });
  }, [currentDashboard, updateDashboard]);

  // Импорт дашборда
  const importDashboard = useCallback(async (file: File): Promise<boolean> => {
    try {
      const text = await file.text();
      const imported: Dashboard = JSON.parse(text);
      
      // Валидация структуры
      if (!imported.name || !Array.isArray(imported.charts)) {
        throw new Error('Неверный формат файла дашборда');
      }
      
      // Обновляем ID и метаданные
      imported.id = Date.now().toString();
      imported.name = `${imported.name} (импорт)`;
      imported.createdAt = Date.now();
      imported.updatedAt = Date.now();
      
      // Обновляем ID графиков
      imported.charts = imported.charts.map(chart => ({
        ...chart,
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      }));
      
      const updated = [...dashboards, imported];
      persistDashboards(updated);
      setCurrentDashboard(imported);
      
      return true;
    } catch (err) {
      console.error('Ошибка импорта:', err);
      setError(err instanceof Error ? err.message : 'Ошибка импорта дашборда');
      return false;
    }
  }, [dashboards, persistDashboards]);

  // Экспорт дашборда
  const exportDashboard = useCallback((dashboard: Dashboard) => {
    try {
      const json = JSON.stringify(dashboard, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `dashboard_${dashboard.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error('Ошибка экспорта:', err);
      setError('Ошибка экспорта дашборда');
    }
  }, []);

  // Переключение дашборда
  const switchToDashboard = useCallback((dashboardId: string | null) => {
    if (dashboardId === null) {
      setCurrentDashboard(null);
      return;
    }
    
    const dashboard = dashboards.find(d => d.id === dashboardId);
    setCurrentDashboard(dashboard || null);
  }, [dashboards]);

  // Переименование дашборда
  const renameDashboard = useCallback((id: string, newName: string) => {
    updateDashboard(id, { name: newName });
  }, [updateDashboard]);

  // Очистка ошибки
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // Состояние
    dashboards,
    currentDashboard,
    loading,
    error,
    
    // Действия с дашбордами
    createDashboard,
    updateDashboard,
    deleteDashboard,
    duplicateDashboard,
    switchToDashboard,
    renameDashboard,
    importDashboard,
    exportDashboard,
    
    // Действия с графиками
    saveChart,
    deleteChart,
    
    // Фильтры
    updateFilters,
    
    // Утилиты
    clearError,
  };
}