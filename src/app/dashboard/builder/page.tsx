'use client';

import { useState, useEffect } from 'react';
import { FileSpreadsheet, Loader, AlertCircle } from 'lucide-react';
import { getExcelData } from '@/lib/storage';
import { dataStore } from '@/lib/data-store';
import { useHierarchy } from '@/hooks/useHierarchy';
import { useDashboardManager } from '@/hooks/useDashboardManager';
import { useChartData } from '@/hooks/useChartData';
import { DashboardHeader } from '@/components/dashboard-builder/DashboardHeader';
import { DashboardToolbar } from '@/components/dashboard-builder/DashboardToolbar';
import { HierarchicalFilter } from '@/components/dashboard-builder/HierarchicalFilter';
import { ChartGrid, FilterStats } from '@/components/dashboard-builder/ChartGrid';
import { ChartEditor } from '@/components/dashboard-builder/ChartEditor';
import { FilterPanel } from '@/components/dashboard-builder/FilterPanel';
import EmptyState from '@/components/dashboard/EmptyState';
import type { SheetData, HierarchyFilters } from '@/types';
import type { ChartConfig } from '@/types/dashboard-builder';
import type { Group } from '@/lib/data-store';

export default function DashboardBuilderPage() {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(true);
  const [editingChart, setEditingChart] = useState<Partial<ChartConfig> | null>(null);
  const [hierarchyFilters, setHierarchyFilters] = useState<HierarchyFilters>({});
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);

  // Хуки
  const { config: hierarchyConfig } = useHierarchy();
  const dashboardManager = useDashboardManager();
  
  const chartDataManager = useChartData({
    sheets,
    groups,
    hierarchyConfig,
    hierarchyFilters,
    dashboardFilters: dashboardManager.currentDashboard?.filters || [],
  });

  // Загрузка данных
  useEffect(() => {
    const loadData = async () => {
      try {
        // Загружаем Excel данные
        const data = getExcelData();
        if (data) setSheets(data);

        // Загружаем группы
        const groupsData = dataStore.getGroups();
        setGroups(groupsData);
        
      } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        setNotification({
          type: 'error',
          message: 'Ошибка загрузки данных'
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Обработчики для дашбордов
  const handleCreateDashboard = (name: string) => {
    const dashboard = dashboardManager.createDashboard(name);
    setNotification({
      type: 'success',
      message: `Дашборд "${dashboard.name}" создан`
    });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleDuplicateDashboard = () => {
    if (!dashboardManager.currentDashboard) return;
    
    const duplicate = dashboardManager.duplicateDashboard(dashboardManager.currentDashboard.id);
    if (duplicate) {
      setNotification({
        type: 'success',
        message: `Дашборд продублирован`
      });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleDeleteDashboard = () => {
    if (!dashboardManager.currentDashboard || !confirm(`Удалить дашборд "${dashboardManager.currentDashboard.name}"?`)) return;
    
    const name = dashboardManager.currentDashboard.name;
    dashboardManager.deleteDashboard(dashboardManager.currentDashboard.id);
    setNotification({
      type: 'info',
      message: `Дашборд "${name}" удален`
    });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleImportDashboard = async (file: File) => {
    const success = await dashboardManager.importDashboard(file);
    if (success) {
      setNotification({
        type: 'success',
        message: 'Дашборд успешно импортирован'
      });
    } else {
      setNotification({
        type: 'error',
        message: dashboardManager.error || 'Ошибка импорта'
      });
    }
    setTimeout(() => setNotification(null), 3000);
  };

  const handleExportDashboard = () => {
    if (dashboardManager.currentDashboard) {
      dashboardManager.exportDashboard(dashboardManager.currentDashboard);
      setNotification({
        type: 'success',
        message: 'Дашборд экспортирован'
      });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  // Обработчики для графиков
  const handleSaveChart = (config: ChartConfig) => {
    dashboardManager.saveChart(config);
    setEditingChart(null);
    setNotification({
      type: 'success',
      message: 'График сохранен'
    });
    setTimeout(() => setNotification(null), 2000);
  };

  const handleDeleteChart = (chartId: string) => {
    if (!confirm('Удалить этот график?')) return;
    
    dashboardManager.deleteChart(chartId);
    setNotification({
      type: 'info',
      message: 'График удален'
    });
    setTimeout(() => setNotification(null), 2000);
  };

  // Обработчики для фильтров
  const handleHierarchyFiltersChange = (filters: HierarchyFilters) => {
    setHierarchyFilters(filters);
  };

  const handleDashboardFiltersChange = (filters: Parameters<typeof dashboardManager.updateFilters>[0]) => {
    dashboardManager.updateFilters(filters);
  };

  // Получаем количество активных фильтров
  const activeFiltersCount = (
    Object.keys(hierarchyFilters).length +
    (dashboardManager.currentDashboard?.filters.filter(f => 
      (f.selectedValues && f.selectedValues.length > 0) ||
      f.rangeMin != null || f.rangeMax != null ||
      f.dateFrom || f.dateTo || f.searchTerm
    ).length || 0)
  );

  if (loading || dashboardManager.loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="animate-spin w-12 h-12 text-blue-600" />
      </div>
    );
  }

  if (!sheets || sheets.length === 0) {
    return (
      <EmptyState
        icon={FileSpreadsheet}
        title="Нет загруженных данных"
        description="Загрузите Excel или CSV файл для создания дашбордов"
        actionLabel="Загрузить данные"
        actionHref="/"
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Уведомления */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg animate-slide-in-right ${
          notification.type === 'success' ? 'bg-green-100 border border-green-200 text-green-800' :
          notification.type === 'error' ? 'bg-red-100 border border-red-200 text-red-800' :
          'bg-blue-100 border border-blue-200 text-blue-800'
        }`}>
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="font-medium">{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            className="ml-2 p-1 hover:bg-black hover:bg-opacity-10 rounded transition-colors"
          >
            ×
          </button>
        </div>
      )}

      {/* Шапка */}
      <DashboardHeader
        dashboards={dashboardManager.dashboards}
        currentDashboard={dashboardManager.currentDashboard}
        isEditMode={isEditMode}
        onDashboardChange={dashboardManager.switchToDashboard}
        onToggleEditMode={() => setIsEditMode(!isEditMode)}
        onCreateDashboard={handleCreateDashboard}
        onDuplicateDashboard={handleDuplicateDashboard}
        onDeleteDashboard={handleDeleteDashboard}
        onExportDashboard={handleExportDashboard}
        onImportDashboard={handleImportDashboard}
        onRenameDashboard={(name) => {
          if (dashboardManager.currentDashboard) {
            dashboardManager.renameDashboard(dashboardManager.currentDashboard.id, name);
          }
        }}
        activeFiltersCount={activeFiltersCount}
      />

      {/* Основной контент */}
      <div className="max-w-7xl mx-auto p-6">
        {dashboardManager.currentDashboard ? (
          <div className="space-y-6">
            {/* Панель инструментов */}
            {isEditMode && (
              <DashboardToolbar
                dashboard={dashboardManager.currentDashboard}
                onAddChart={() => setEditingChart({})}
              />
            )}
            
            {/* Статистика фильтрации */}
            {chartDataManager.filterStats.hasFilters && (
              <FilterStats
                totalRows={chartDataManager.filterStats.totalRows}
                filteredRows={chartDataManager.filterStats.filteredRows}
                percentage={chartDataManager.filterStats.filterPercentage}
              />
            )}
            
            {/* Область фильтров и графиков */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
              {/* Левая панель - фильтры */}
              <div className="xl:col-span-1 space-y-6">
                {/* Иерархические фильтры */}
                <HierarchicalFilter
                  hierarchyConfig={hierarchyConfig}
                  data={sheets[0]?.rows || []}
                  currentFilters={hierarchyFilters}
                  onFiltersChange={handleHierarchyFiltersChange}
                />
                
                {/* Обычные фильтры */}
                <FilterPanel
                  filters={dashboardManager.currentDashboard.filters}
                  availableColumns={sheets[0]?.headers || []}
                  data={chartDataManager.filteredData}
                  onFiltersChange={handleDashboardFiltersChange}
                  onAddFilter={(filter) => {
                    const updated = [...dashboardManager.currentDashboard!.filters, filter];
                    handleDashboardFiltersChange(updated);
                  }}
                  onRemoveFilter={(filterId) => {
                    const updated = dashboardManager.currentDashboard!.filters.filter(f => f.id !== filterId);
                    handleDashboardFiltersChange(updated);
                  }}
                  className="xl:sticky xl:top-6"
                />
              </div>
              
              {/* Правая область - графики */}
              <div className="xl:col-span-3">
                <div className="grid grid-cols-12 gap-4 auto-rows-auto">
                  <ChartGrid
                    charts={dashboardManager.currentDashboard.charts}
                    getChartData={chartDataManager.getChartData}
                    isEditMode={isEditMode}
                    onEditChart={setEditingChart}
                    onDeleteChart={handleDeleteChart}
                    onAddChart={() => setEditingChart({})}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Нет дашбордов */
          <EmptyState
            icon={FileSpreadsheet}
            title="Создайте свой первый дашборд"
            description="Дашборды позволяют визуализировать данные с помощью графиков и таблиц. Создавайте интерактивные отчёты для анализа."
            actionLabel="Создать дашборд"
            actionOnClick={() => handleCreateDashboard('Мой первый дашборд')}
          />
        )}
      </div>

      {/* Редактор графика */}
      {editingChart && (
        <ChartEditor
          config={editingChart}
          availableGroups={chartDataManager.groupsData.map(g => ({
            id: g.id,
            name: g.name,
            indicators: g.indicators,
          }))}
          availableColumns={sheets[0]?.headers || []}
          globalIndicators={chartDataManager.availableIndicators}
          onSave={handleSaveChart}
          onCancel={() => setEditingChart(null)}
        />
      )}
    </div>
  );
}