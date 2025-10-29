'use client';

import { useEffect, useState, useMemo } from 'react';
import { getExcelData } from '@/lib/storage';
import { applyFilters, evaluateFormula } from '@/lib/excel-parser';
import { SheetData } from '@/types';
import { 
  AlertCircle, 
  BarChart3, 
  Download,
  FileSpreadsheet,
  Users,
  TrendingUp,
  Layers,
  Filter as FilterIcon,
} from 'lucide-react';
import Loader from '@/components/loader';
import EmptyState from '@/components/dashboard/EmptyState';
import GroupSelector from '@/components/dashboard/GroupSelector';
import ComparisonTable from '@/components/dashboard/ComparisonTable';
import ChartWrapper from '@/components/charts/ChartWrapper';
import BarChart from '@/components/charts/BarChart';
import LineChart from '@/components/charts/LineChart';
import PieChart from '@/components/charts/PieChart';

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

export default function ComparisonPage() {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [hierarchyConfig, setHierarchyConfig] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectedIndicator, setSelectedIndicator] = useState<string>('');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>('bar');

  useEffect(() => {
    const data = getExcelData();
    if (data) setSheets(data);

    const savedGroups = localStorage.getItem('analyticsGroups');
    if (savedGroups) setGroups(JSON.parse(savedGroups));

    const savedConfig = localStorage.getItem('hierarchyConfig');
    if (savedConfig) setHierarchyConfig(JSON.parse(savedConfig));

    setLoading(false);
  }, []);

  // Получаем общие показатели для выбранных групп
  const commonIndicators = useMemo(() => {
    if (selectedGroupIds.length === 0) return [];
    
    const selectedGroups = groups.filter(g => selectedGroupIds.includes(g.id));
    
    if (selectedGroups.length === 0) return [];
    if (selectedGroups.length === 1) {
      return selectedGroups[0].indicators.map(i => i.name);
    }
    
    const firstGroupIndicators = new Set(selectedGroups[0].indicators.map(i => i.name));
    
    const common = Array.from(firstGroupIndicators).filter(indicatorName => 
      selectedGroups.every(group => 
        group.indicators.some(ind => ind.name === indicatorName)
      )
    );
    
    return common;
  }, [groups, selectedGroupIds]);

  // Автовыбор первого показателя
  useEffect(() => {
    if (commonIndicators.length > 0 && !commonIndicators.includes(selectedIndicator)) {
      setSelectedIndicator(commonIndicators[0]);
    } else if (commonIndicators.length === 0) {
      setSelectedIndicator('');
    }
  }, [commonIndicators, selectedIndicator]);

  // Вычисление данных для сравнения
  const comparisonData = useMemo(() => {
    if (!sheets || sheets.length === 0 || selectedGroupIds.length === 0 || !selectedIndicator) {
      return [];
    }

    const selectedGroups = groups.filter(g => selectedGroupIds.includes(g.id));

    return selectedGroups.map((group) => {
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

      const filteredData = applyFilters(sheets[0].rows, allFilters);

      const indicator = group.indicators.find(ind => ind.name === selectedIndicator);
      if (!indicator) return { name: group.name, value: 0 };

      try {
        const value = evaluateFormula(indicator.formula, filteredData, sheets[0].headers);
        return { name: group.name, value };
      } catch (error) {
        return { name: group.name, value: 0 };
      }
    });
  }, [sheets, groups, selectedGroupIds, selectedIndicator, hierarchyConfig]);

  // Экспорт
  const exportToCSV = () => {
    if (comparisonData.length === 0) return;

    const headers = ['Группа', selectedIndicator];
    const rows = comparisonData.map(item => [item.name, item.value.toFixed(2)]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `comparison_${selectedIndicator}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Обработчики выбора групп
  const toggleGroupSelection = (id: string) => {
    setSelectedGroupIds(prev =>
      prev.includes(id) ? prev.filter(gid => gid !== id) : [...prev, id]
    );
  };

  const selectAllGroups = () => {
    setSelectedGroupIds(groups.map(g => g.id));
  };

  const clearAllGroups = () => {
    setSelectedGroupIds([]);
  };

  if (loading) {
    return <Loader title="Загрузка сравнения..." />;
  }

  if (!sheets || sheets.length === 0) {
    return (
      <EmptyState
        icon={FileSpreadsheet}
        title="Нет загруженных данных"
        description="Загрузите Excel или CSV файл для начала работы"
        actionLabel="Загрузить данные"
        actionHref="/"
      />
    );
  }

  if (groups.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Нет созданных групп"
        description="Создайте группы показателей для сравнения"
        actionLabel="Создать группу"
        actionHref="/groups"
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Заголовок */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Сравнение групп
          </h1>
          <p className="text-gray-600">
            Сравните одинаковый показатель между разными группами
          </p>
        </div>
        {comparisonData.length > 0 && (
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 transition-colors"
          >
            <Download size={18} />
            Экспорт
          </button>
        )}
      </div>

      {/* Селектор групп */}
      <GroupSelector
        groups={groups}
        selectedIds={selectedGroupIds}
        onToggle={toggleGroupSelection}
        onSelectAll={selectAllGroups}
        onClearAll={clearAllGroups}
      />

      {/* Выбор показателя */}
      {selectedGroupIds.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <label className="block text-sm font-bold text-gray-700 mb-3">
            📊 Показатель для сравнения:
          </label>
          <select
            value={selectedIndicator}
            onChange={(e) => setSelectedIndicator(e.target.value)}
            className="w-full px-4 py-3 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
            disabled={commonIndicators.length === 0}
          >
            <option value="">
              {commonIndicators.length === 0 
                ? '-- Нет общих показателей --' 
                : '-- Выберите показатель --'
              }
            </option>
            {commonIndicators.map(ind => (
              <option key={ind} value={ind}>{ind}</option>
            ))}
          </select>
          
          {selectedGroupIds.length > 1 && commonIndicators.length === 0 && (
            <div className="mt-3 p-3 bg-orange-50 border border-orange-300 rounded-lg flex items-start gap-2">
              <AlertCircle size={18} className="text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-orange-800">
                <p className="font-semibold">⚠️ У выбранных групп нет общих показателей</p>
                <p className="mt-1">Выберите группы с одинаковыми показателями или создайте их используя библиотеку показателей</p>
              </div>
            </div>
          )}
          
          {commonIndicators.length > 0 && (
            <div className="mt-3 p-3 bg-green-50 border border-green-300 rounded-lg text-sm text-green-800">
              ✓ Доступно <strong>{commonIndicators.length}</strong> {commonIndicators.length === 1 ? 'общий показатель' : 'общих показателей'}
            </div>
          )}
        </div>
      )}

      {/* Результаты сравнения */}
      {selectedIndicator && comparisonData.length > 0 ? (
        <div className="space-y-6">
          {/* Переключатель типа графика */}
          <div className="bg-white rounded-xl shadow-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Тип визуализации:</span>
              <div className="flex gap-2">
                {[
                  { type: 'bar' as const, label: 'Столбцы', icon: BarChart3 },
                  { type: 'line' as const, label: 'Линии', icon: TrendingUp },
                  { type: 'pie' as const, label: 'Круговая', icon: Layers },
                ].map(({ type, label, icon: Icon }) => (
                  <button
                    key={type}
                    onClick={() => setChartType(type)}
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
                      chartType === type
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Icon size={18} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* График */}
          <ChartWrapper
            title={`Сравнение: ${selectedIndicator}`}
            description={`Данные по ${comparisonData.length} группам`}
          >
            {chartType === 'bar' && (
              <BarChart data={comparisonData} indicators="value" height={450} />
            )}
            {chartType === 'line' && (
              <LineChart data={comparisonData} indicators="value" height={450} />
            )}
            {chartType === 'pie' && (
              <PieChart data={comparisonData} height={450} />
            )}
          </ChartWrapper>

          {/* Таблица */}
          <ComparisonTable data={comparisonData} indicator={selectedIndicator} />
        </div>
      ) : selectedGroupIds.length > 0 ? (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <BarChart3 size={64} className="mx-auto text-gray-300 mb-4" />
          <p className="text-xl text-gray-600 mb-2">
            {commonIndicators.length === 0 
              ? 'Нет общих показателей' 
              : 'Выберите показатель для сравнения'
            }
          </p>
          <p className="text-sm text-gray-500">
            {commonIndicators.length === 0
              ? 'Выберите группы с одинаковыми показателями'
              : `Выберите один из ${commonIndicators.length} доступных показателей выше`
            }
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <Users size={64} className="mx-auto text-gray-300 mb-4" />
          <p className="text-xl text-gray-600 mb-2">Выберите группы для сравнения</p>
          <p className="text-sm text-gray-500">
            Выберите 2 или более групп выше, чтобы увидеть сравнение
          </p>
        </div>
      )}
    </div>
  );
}
