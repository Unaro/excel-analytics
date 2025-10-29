'use client';

import { useEffect, useState, useMemo } from 'react';
import { getExcelData } from '@/lib/storage';
import { applyFilters, evaluateFormula } from '@/lib/excel-parser';
import { SheetData } from '@/types';
import { Dashboard, ChartConfig } from '@/types/dashboard-builder';
import { 
  FileSpreadsheet,
  Plus,
  Save,
  Eye,
  EyeOff,
  Download,
  Upload,
  Layout,
  Trash2,
  Copy,
} from 'lucide-react';
import Loader from '@/components/loader';
import EmptyState from '@/components/dashboard/EmptyState';
import ChartEditor from '@/components/dashboard-builder/ChartEditor';
import ChartRenderer from '@/components/dashboard-builder/ChartRenderer';
import FilterPanel from '@/components/dashboard-builder/FilterPanel';
import { DashboardFilter } from '@/types/dashboard-builder';

interface Group {
  id: string;
  name: string;
  filters: Array<{
    id: string;
    column: string;
    operator: string;
    value: string;
  }>;
  indicators: Array<{
    id: string;
    name: string;
    formula: string;
  }>;
  hierarchyFilters?: Record<string, string>;
}

export default function DashboardBuilderPage() {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [hierarchyConfig, setHierarchyConfig] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [currentDashboard, setCurrentDashboard] = useState<Dashboard | null>(null);
  const [isEditMode, setIsEditMode] = useState(true);
  const [editingChart, setEditingChart] = useState<Partial<ChartConfig> | null>(null);
  const [showDashboardDialog, setShowDashboardDialog] = useState(false);
  const [dashboardName, setDashboardName] = useState('');
  const [activeFilters, setActiveFilters] = useState<DashboardFilter[]>([]);

  useEffect(() => {
    const data = getExcelData();
    if (data) setSheets(data);

    const savedGroups = localStorage.getItem('analyticsGroups');
    if (savedGroups) setGroups(JSON.parse(savedGroups));

    const savedConfig = localStorage.getItem('hierarchyConfig');
    if (savedConfig) setHierarchyConfig(JSON.parse(savedConfig));

    const savedDashboards = localStorage.getItem('dashboards');
    if (savedDashboards) {
      const parsed = JSON.parse(savedDashboards);
      setDashboards(parsed);
      if (parsed.length > 0) setCurrentDashboard(parsed[0]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (currentDashboard) {
        setActiveFilters(currentDashboard.filters || []);
    }
  }, [currentDashboard]);

    const applyDashboardFilters = (data: any[]): any[] => {
        if (!activeFilters || activeFilters.length === 0) return data;

        return data.filter(row => {
            return activeFilters.every(filter => {
            const value = row[filter.column];

            // SELECT фильтр
            if (filter.type === 'select' && filter.selectedValues && filter.selectedValues.length > 0) {
                return filter.selectedValues.includes(String(value));
            }

            // MULTISELECT фильтр
            if (filter.type === 'multiselect' && filter.selectedValues && filter.selectedValues.length > 0) {
                return filter.selectedValues.includes(String(value));
            }

            // RANGE фильтр
            if (filter.type === 'range') {
                const numValue = Number(value);
                if (filter.rangeMin != null && numValue < filter.rangeMin) return false;
                if (filter.rangeMax != null && numValue > filter.rangeMax) return false;
            }

            // DATE фильтр
            if (filter.type === 'date') {
                const dateValue = new Date(value);
                if (filter.dateFrom && dateValue < new Date(filter.dateFrom)) return false;
                if (filter.dateTo && dateValue > new Date(filter.dateTo)) return false;
            }

            // SEARCH фильтр
            if (filter.type === 'search' && filter.searchTerm) {
                return String(value).toLowerCase().includes(filter.searchTerm.toLowerCase());
            }

            return true;
            });
        });
    };

    // Подготовка данных для групп
    const groupsData = useMemo(() => {
    if (!sheets || sheets.length === 0 || groups.length === 0) return [];

    return groups.map(group => {
        const getDeepestHierarchyFilter = (hierarchyFilters: Record<string, string> | undefined) => {
        if (!hierarchyFilters || !hierarchyConfig.length) return null;
        let deepestLevel = null;
        for (let i = hierarchyConfig.length - 1; i >= 0; i--) {
            const col = hierarchyConfig[i];
            if (hierarchyFilters[col]) {
            deepestLevel = { column: col, value: hierarchyFilters[col] };
            break;
            }
        }
        return deepestLevel;
        };

        const deepestFilter = getDeepestHierarchyFilter(group.hierarchyFilters);
        const allFilters = [
        ...group.filters,
        ...(deepestFilter ? [{
            id: 'hier_deepest',
            column: deepestFilter.column,
            operator: '=',
            value: deepestFilter.value,
        }] : []),
        ];

        // Применяем фильтры группы
        let filteredData = applyFilters(sheets[0].rows, allFilters);
        
        // Применяем фильтры дашборда
        filteredData = applyDashboardFilters(filteredData);

        const indicators = group.indicators.map(indicator => {
        try {
            const value = evaluateFormula(indicator.formula, filteredData, sheets[0].headers);
            return { name: indicator.name, value };
        } catch {
            return { name: indicator.name, value: 0 };
        }
        });

        return {
        id: group.id,
        name: group.name,
        indicators: group.indicators.map(i => i.name),
        data: indicators,
        };
    });
    }, [sheets, groups, hierarchyConfig, activeFilters]); // Добавили activeFilters в зависимости

    // Функции для работы с фильтрами:
    const handleFiltersChange = (filters: DashboardFilter[]) => {
    setActiveFilters(filters);
    
    if (currentDashboard) {
        const updatedDashboard = {
        ...currentDashboard,
        filters,
        updatedAt: Date.now(),
        };
        
        setCurrentDashboard(updatedDashboard);
        
        const updatedDashboards = dashboards.map(d => 
        d.id === updatedDashboard.id ? updatedDashboard : d
        );
        setDashboards(updatedDashboards);
        localStorage.setItem('dashboards', JSON.stringify(updatedDashboards));
    }
    };

    const handleAddFilter = (filter: DashboardFilter) => {
        const updated = [...activeFilters, filter];
        handleFiltersChange(updated);
    };

    const handleRemoveFilter = (filterId: string) => {
        const updated = activeFilters.filter(f => f.id !== filterId);
        handleFiltersChange(updated);
    };

  // Получение данных для чарта
  const getChartData = (config: ChartConfig) => {
    if (config.dataSource === 'groups' && config.groupIds) {
      const selectedGroups = groupsData.filter(g => config.groupIds!.includes(g.id));
      
      if (config.indicators && config.indicators.length > 0) {
        return selectedGroups.map(group => {
          const result: any = { name: group.name };
          config.indicators!.forEach(ind => {
            const indicator = group.data.find(d => d.name === ind);
            result[ind] = indicator ? indicator.value : 0;
          });
          return result;
        });
      }
      
      return selectedGroups.map(g => ({
        name: g.name,
        value: g.data[0]?.value || 0,
      }));
    }
    
    return [];
  };

  // Создание нового дашборда
    const createDashboard = () => {
        if (!dashboardName.trim()) {
            alert('Введите название дашборда');
            return;
        }

        const newDashboard: Dashboard = {
            id: Date.now().toString(),
            name: dashboardName,
            charts: [],
            filters: [], // Инициализируем пустыми фильтрами
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        const updated = [...dashboards, newDashboard];
        setDashboards(updated);
        setCurrentDashboard(newDashboard);
        localStorage.setItem('dashboards', JSON.stringify(updated));
        
        setShowDashboardDialog(false);
        setDashboardName('');
    };

  // Сохранение чарта
  const saveChart = (config: ChartConfig) => {
    if (!currentDashboard) return;

    const existingIndex = currentDashboard.charts.findIndex(c => c.id === config.id);
    const updatedCharts = existingIndex >= 0
      ? currentDashboard.charts.map(c => c.id === config.id ? config : c)
      : [...currentDashboard.charts, config];

    const updatedDashboard = {
      ...currentDashboard,
      charts: updatedCharts,
      updatedAt: Date.now(),
    };

    setCurrentDashboard(updatedDashboard);
    
    const updatedDashboards = dashboards.map(d => 
      d.id === updatedDashboard.id ? updatedDashboard : d
    );
    setDashboards(updatedDashboards);
    localStorage.setItem('dashboards', JSON.stringify(updatedDashboards));
    
    setEditingChart(null);
  };

  // Удаление чарта
  const deleteChart = (chartId: string) => {
    if (!currentDashboard || !confirm('Удалить этот график?')) return;

    const updatedDashboard = {
      ...currentDashboard,
      charts: currentDashboard.charts.filter(c => c.id !== chartId),
      updatedAt: Date.now(),
    };

    setCurrentDashboard(updatedDashboard);
    
    const updatedDashboards = dashboards.map(d => 
      d.id === updatedDashboard.id ? updatedDashboard : d
    );
    setDashboards(updatedDashboards);
    localStorage.setItem('dashboards', JSON.stringify(updatedDashboards));
  };

  // Экспорт дашборда
  const exportDashboard = () => {
    if (!currentDashboard) return;
    
    const json = JSON.stringify(currentDashboard, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `dashboard_${currentDashboard.name}_${Date.now()}.json`;
    link.click();
  };

  // Импорт дашборда
  const importDashboard = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported: Dashboard = JSON.parse(event.target?.result as string);
        imported.id = Date.now().toString();
        imported.name = `${imported.name} (импорт)`;
        
        const updated = [...dashboards, imported];
        setDashboards(updated);
        setCurrentDashboard(imported);
        localStorage.setItem('dashboards', JSON.stringify(updated));
        
        alert('Дашборд импортирован!');
      } catch (err) {
        alert('Ошибка импорта файла');
      }
    };
    reader.readAsText(file);
  };

  if (loading) {
    return <Loader title="Загрузка конструктора..." />;
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Название и селектор дашборда */}
            <div className="flex items-center gap-4 flex-1">
              <Layout size={32} className="text-blue-600" />
              <div>
                <select
                  value={currentDashboard?.id || ''}
                  onChange={(e) => {
                    const dashboard = dashboards.find(d => d.id === e.target.value);
                    setCurrentDashboard(dashboard || null);
                  }}
                  className="text-xl font-bold border-none bg-transparent focus:outline-none cursor-pointer"
                >
                  {dashboards.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                {currentDashboard && (
                    <p className="text-xs text-gray-500">
                        {currentDashboard.charts.length} графиков
                        {activeFilters.length > 0 && (
                        <>
                            {' • '}
                            <span className="text-blue-600 font-semibold">
                            {activeFilters.filter(f => 
                                (f.selectedValues && f.selectedValues.length > 0) ||
                                f.rangeMin != null || f.rangeMax != null ||
                                f.dateFrom || f.dateTo || f.searchTerm
                            ).length} активных фильтров
                            </span>
                        </>
                        )}
                        {' • '}
                        Обновлено: {new Date(currentDashboard.updatedAt).toLocaleString('ru-RU')}
                    </p>
                )}

              </div>
            </div>

            {/* Действия */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDashboardDialog(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 font-semibold transition-colors"
              >
                <Plus size={18} />
                Новый дашборд
              </button>
              
              <button
                onClick={() => setIsEditMode(!isEditMode)}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 font-semibold transition-colors ${
                  isEditMode
                    ? 'bg-orange-600 hover:bg-orange-700 text-white'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {isEditMode ? <EyeOff size={18} /> : <Eye size={18} />}
                {isEditMode ? 'Режим просмотра' : 'Режим редактирования'}
              </button>

              {currentDashboard && (
                <>
                  <button
                    onClick={exportDashboard}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <Download size={18} />
                  </button>
                  
                  <label className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg flex items-center gap-2 cursor-pointer transition-colors">
                    <Upload size={18} />
                    <input
                      type="file"
                      accept=".json"
                      onChange={importDashboard}
                      className="hidden"
                    />
                  </label>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-6">
        {currentDashboard ? (
          <div className="space-y-6">
            {/* Панель инструментов */}
            {isEditMode && (
              <div className="bg-white rounded-xl shadow-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setEditingChart({})}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg flex items-center gap-2 font-bold hover:from-blue-700 hover:to-purple-700 transition-all shadow-md"
                  >
                    <Plus size={20} />
                    Добавить график
                  </button>
                  
                  <span className="text-sm text-gray-600">
                    {currentDashboard.charts.length} графиков на дашборде
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (!currentDashboard) return;
                      const copy: Dashboard = {
                        ...currentDashboard,
                        id: Date.now().toString(),
                        name: `${currentDashboard.name} (копия)`,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                      };
                      const updated = [...dashboards, copy];
                      setDashboards(updated);
                      setCurrentDashboard(copy);
                      localStorage.setItem('dashboards', JSON.stringify(updated));
                    }}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <Copy size={18} />
                    Дублировать
                  </button>
                  
                  <button
                    onClick={() => {
                      if (!confirm('Удалить этот дашборд?')) return;
                      const updated = dashboards.filter(d => d.id !== currentDashboard.id);
                      setDashboards(updated);
                      setCurrentDashboard(updated[0] || null);
                      localStorage.setItem('dashboards', JSON.stringify(updated));
                    }}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            )}

            {/* Панель фильтров */}
            <FilterPanel
                filters={activeFilters}
                availableColumns={sheets[0]?.headers || []}
                data={sheets[0]?.rows || []}
                onFiltersChange={handleFiltersChange}
                onAddFilter={handleAddFilter}
                onRemoveFilter={handleRemoveFilter}
            />

            {/* Grid с графиками */}
            {currentDashboard.charts.length > 0 ? (
              <div
                className="grid gap-6"
                style={{
                  gridTemplateColumns: 'repeat(12, 1fr)',
                  gridAutoRows: '80px',
                }}
              >
                {currentDashboard.charts.map((chart) => (
                  <ChartRenderer
                    key={chart.id}
                    config={chart}
                    data={getChartData(chart)}
                    isEditMode={isEditMode}
                    onEdit={() => setEditingChart(chart)}
                    onDelete={() => deleteChart(chart.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-lg p-16 text-center">
                <Layout size={64} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  Дашборд пуст
                </h3>
                <p className="text-gray-600 mb-6">
                  Добавьте первый график для начала работы
                </p>
                <button
                  onClick={() => setEditingChart({})}
                  className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg flex items-center gap-2 font-bold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg mx-auto"
                >
                  <Plus size={24} />
                  Добавить график
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Нет дашбордов */
          <div className="bg-white rounded-xl shadow-lg p-16 text-center">
            <Layout size={96} className="mx-auto text-gray-300 mb-6" />
            <h2 className="text-3xl font-bold text-gray-900 mb-3">
              Создайте свой первый дашборд
            </h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Дашборды позволяют визуализировать данные с помощью графиков и таблиц.
              Создавайте интерактивные отчёты для анализа.
            </p>
            <button
              onClick={() => setShowDashboardDialog(true)}
              className="px-10 py-5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl flex items-center gap-3 font-bold text-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-xl mx-auto"
            >
              <Plus size={28} />
              Создать дашборд
            </button>
          </div>
        )}
      </div>

        

      {/* Диалог создания дашборда */}
      {showDashboardDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Новый дашборд</h3>
            <input
              type="text"
              value={dashboardName}
              onChange={(e) => setDashboardName(e.target.value)}
              placeholder="Название дашборда..."
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') createDashboard();
                if (e.key === 'Escape') setShowDashboardDialog(false);
              }}
            />
            <div className="flex gap-3">
              <button
                onClick={createDashboard}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
              >
                Создать
              </button>
              <button
                onClick={() => {
                  setShowDashboardDialog(false);
                  setDashboardName('');
                }}
                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg font-semibold transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Редактор графика */}
      {editingChart && (
        <ChartEditor
          config={editingChart}
          availableGroups={groupsData.map(g => ({
            id: g.id,
            name: g.name,
            indicators: g.indicators,
          }))}
          availableColumns={sheets[0]?.headers || []}
          onSave={saveChart}
          onCancel={() => setEditingChart(null)}
        />
      )}
    </div>
  );
}
