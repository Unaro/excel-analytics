'use client';

import { useEffect, useState, useMemo } from 'react';
import { getExcelData } from '@/lib/storage';
import { applyFilters, evaluateFormula } from '@/lib/excel-parser';
import { SheetData } from '@/types';
import { 
  FileSpreadsheet,
  Users,
  TrendingUp,
  Eye,
  Download,
  BarChart3,
  Table as TableIcon,
  Activity,
  Check,
} from 'lucide-react';
import Loader from '@/components/loader';
import DetailCard from '@/components/dashboard/DetailCard';
import EmptyState from '@/components/dashboard/EmptyState';
import KPICard from '@/components/dashboard/KPICard';
import ChartWrapper from '@/components/charts/ChartWrapper';
import BarChart from '@/components/charts/BarChart';
import LineChart from '@/components/charts/LineChart';
import PieChart from '@/components/charts/PieChart';
import SummaryTable from '@/components/dashboard/SummaryTable';
import { ChartDataPoint } from '@/types/dashboard';

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

type Tab = 'cards' | 'charts' | 'table';

export default function OverviewPage() {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [hierarchyConfig, setHierarchyConfig] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('cards');
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');

  useEffect(() => {
    const data = getExcelData();
    if (data) setSheets(data);

    const savedGroups = localStorage.getItem('analyticsGroups');
    if (savedGroups) setGroups(JSON.parse(savedGroups));

    const savedConfig = localStorage.getItem('hierarchyConfig');
    if (savedConfig) setHierarchyConfig(JSON.parse(savedConfig));

    setLoading(false);
  }, []);

  // Вычисление результатов для всех групп
  const groupResults = useMemo(() => {
    if (!sheets || sheets.length === 0 || groups.length === 0) return [];

    return groups.map((group) => {
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

      const indicators = group.indicators.map((indicator) => {
        try {
          const value = evaluateFormula(indicator.formula, filteredData, sheets[0].headers);
          return {
            name: indicator.name,
            formula: indicator.formula,
            value,
          };
        } catch {
          return {
            name: indicator.name,
            formula: indicator.formula,
            value: 0,
          };
        }
      });

      return {
        groupId: group.id,
        groupName: group.name,
        filters: group.filters,
        hierarchyFilters: group.hierarchyFilters,
        deepestFilter,
        indicators,
        rowCount: filteredData.length,
      };
    });
  }, [sheets, groups, hierarchyConfig]);

  // Получаем все уникальные показатели из всех групп
  const allIndicatorNames = useMemo(() => {
    const names = new Set<string>();
    groups.forEach(group => {
      group.indicators.forEach(ind => names.add(ind.name));
    });
    return Array.from(names).sort();
  }, [groups]);

  // Получаем общие показатели (которые есть во всех группах)
  const commonIndicatorNames = useMemo(() => {
    if (groups.length === 0) return [];
    if (groups.length === 1) return groups[0].indicators.map(i => i.name);

    const firstGroupIndicators = new Set(groups[0].indicators.map(i => i.name));
    
    return Array.from(firstGroupIndicators).filter(indicatorName => 
      groups.every(group => 
        group.indicators.some(ind => ind.name === indicatorName)
      )
    );
  }, [groups]);

  // Автовыбор первого общего показателя
  useEffect(() => {
    if (commonIndicatorNames.length > 0 && selectedIndicators.length === 0) {
      setSelectedIndicators([commonIndicatorNames[0]]);
    }
  }, [commonIndicatorNames, selectedIndicators.length]);

  // KPI метрики
  const kpiMetrics = useMemo(() => {
    if (groupResults.length === 0) return null;

    const totalRecords = groupResults.reduce((sum, g) => sum + g.rowCount, 0);
    const avgRecordsPerGroup = totalRecords / groupResults.length;
    const totalIndicators = groupResults.reduce((sum, g) => sum + g.indicators.length, 0);

    return {
      totalGroups: groupResults.length,
      totalRecords,
      avgRecordsPerGroup: avgRecordsPerGroup.toFixed(0),
      totalIndicators,
    };
  }, [groupResults]);

  // Данные для графиков - с выбранными показателями
  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (groupResults.length === 0 || selectedIndicators.length === 0) return [];

    return groupResults.map(group => {
      const dataPoint: ChartDataPoint = { 
        name: group.groupName 
      };
      
      selectedIndicators.forEach(indicatorName => {
        const indicator = group.indicators.find(i => i.name === indicatorName);
        dataPoint[indicatorName] = indicator ? indicator.value : 0;
      });

      return dataPoint;
    });
  }, [groupResults, selectedIndicators]);


  // Переключение выбора показателя
  const toggleIndicatorSelection = (name: string) => {
    setSelectedIndicators(prev => 
      prev.includes(name) 
        ? prev.filter(n => n !== name)
        : [...prev, name]
    );
  };

  // Экспорт в CSV
  const exportToCSV = () => {
    const headers = ['Группа', ...allIndicatorNames, 'Записей'];
    const rows = groupResults.map(group => [
      group.groupName,
      ...allIndicatorNames.map(name => {
        const ind = group.indicators.find(i => i.name === name);
        return ind ? ind.value.toFixed(2) : '—';
      }),
      group.rowCount.toString(),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `overview_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (loading) {
    return <Loader title="Загрузка обзора..." />;
  }

  if (!sheets || sheets.length === 0) {
    return (
      <EmptyState
        icon={FileSpreadsheet}
        title="Нет загруженных данных"
        description="Загрузите Excel или CSV файл для начала работы с аналитикой"
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
        description="Создайте группы показателей для анализа ваших данных"
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
            Обзор показателей
          </h1>
          <p className="text-gray-600">
            Сводка по всем группам и показателям
          </p>
        </div>
        <button
          onClick={exportToCSV}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 transition-colors shadow-md hover:shadow-lg"
        >
          <Download size={18} />
          Экспорт
        </button>
      </div>

      {/* KPI карточки */}
      {kpiMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Всего групп"
            value={kpiMetrics.totalGroups}
            icon={Users}
            color="#3b82f6"
            subtitle="Активных групп показателей"
          />
          <KPICard
            title="Всего записей"
            value={kpiMetrics.totalRecords.toLocaleString()}
            icon={FileSpreadsheet}
            color="#8b5cf6"
            subtitle="Обработано данных"
          />
          <KPICard
            title="Средний размер группы"
            value={kpiMetrics.avgRecordsPerGroup}
            icon={BarChart3}
            color="#10b981"
            subtitle="Записей на группу"
          />
          <KPICard
            title="Всего показателей"
            value={kpiMetrics.totalIndicators}
            icon={TrendingUp}
            color="#f59e0b"
            subtitle="Вычисляемых метрик"
          />
        </div>
      )}

      {/* Табы */}
      <div className="bg-white rounded-xl shadow-lg">
        <div className="border-b border-gray-200">
          <div className="flex flex-wrap gap-2 p-2">
            {[
              { id: 'cards' as Tab, label: 'Карточки', icon: Eye },
              { id: 'charts' as Tab, label: 'Графики', icon: Activity },
              { id: 'table' as Tab, label: 'Таблица', icon: TableIcon },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all
                  ${activeTab === tab.id
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-100'
                  }
                `}
              >
                <tab.icon size={18} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {/* Таб: Карточки */}
          {activeTab === 'cards' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {groupResults.map((result, idx) => (
                <DetailCard
                  key={result.groupId}
                  data={result}
                  index={idx}
                />
              ))}
            </div>
          )}

          {/* Таб: Графики */}
          {activeTab === 'charts' && (
            <div className="space-y-6">
              {/* Панель выбора показателей */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border-2 border-blue-200">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">
                      Выберите показатели для отображения
                    </h3>
                    <p className="text-sm text-gray-600">
                      {commonIndicatorNames.length > 0 
                        ? `Доступно ${commonIndicatorNames.length} общих показателей`
                        : 'Выберите из всех показателей'
                      }
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setChartType('bar')}
                      className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
                        chartType === 'bar'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <BarChart3 size={18} />
                      Столбцы
                    </button>
                    <button
                      onClick={() => setChartType('line')}
                      className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
                        chartType === 'line'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <TrendingUp size={18} />
                      Линии
                    </button>
                  </div>
                </div>

                {/* Список показателей для выбора */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {(commonIndicatorNames.length > 0 ? commonIndicatorNames : allIndicatorNames).map(name => {
                    const isSelected = selectedIndicators.includes(name);
                    const isCommon = commonIndicatorNames.includes(name);

                    return (
                      <button
                        key={name}
                        onClick={() => toggleIndicatorSelection(name)}
                        className={`
                          relative px-3 py-2 rounded-lg text-sm font-medium transition-all text-left
                          ${isSelected
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                          }
                        `}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">{name}</span>
                          {isSelected && <Check size={14} />}
                        </div>
                        {!isCommon && (
                          <span className="absolute top-1 right-1 w-2 h-2 bg-orange-400 rounded-full" title="Не во всех группах" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {selectedIndicators.length > 0 && (
                  <div className="mt-3 p-2 bg-white rounded border border-blue-300 text-sm text-blue-800">
                    <strong>Выбрано:</strong> {selectedIndicators.length} показателей
                  </div>
                )}
              </div>

              {/* Графики */}
              {selectedIndicators.length > 0 ? (
                <div className="space-y-6">
                  {/* Основной график */}
                  <ChartWrapper
                    title={`Сравнение показателей: ${selectedIndicators.join(', ')}`}
                    description={`Данные по ${groupResults.length} группам`}
                  >
                    {chartType === 'bar' ? (
                      <BarChart 
                        data={chartData} 
                        indicators={selectedIndicators}
                        height={450}
                      />
                    ) : (
                      <LineChart 
                        data={chartData} 
                        indicators={selectedIndicators}
                        height={450}
                      />
                    )}
                  </ChartWrapper>

                  {/* Дополнительные графики для каждого показателя */}
                  {selectedIndicators.length === 1 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <ChartWrapper title={`${selectedIndicators[0]} - Круговая диаграмма`}>
                        <PieChart 
                          data={chartData.map(d => {
                            const value = d[selectedIndicators[0]];
                            return {
                              name: d.name,
                              value: typeof value === 'number' ? value : 0 
                            };
                          })} 
                          height={350}
                        />
                      </ChartWrapper>

                      <ChartWrapper title={`${selectedIndicators[0]} - Линейный тренд`}>
                        <LineChart 
                          data={chartData} 
                          indicators={selectedIndicators[0]}
                          height={350}
                        />
                      </ChartWrapper>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <BarChart3 size={64} className="mx-auto mb-4 text-gray-300" />
                  <p className="text-lg">Выберите показатели для отображения</p>
                  <p className="text-sm mt-1">Выберите один или несколько показателей выше</p>
                </div>
              )}
            </div>
          )}

          {/* Таб: Таблица */}
          {activeTab === 'table' && (
            <SummaryTable
              data={groupResults.map(group => ({
                groupId: group.groupId,
                groupName: group.groupName,
                indicators: group.indicators,
                rowCount: group.rowCount,
              }))}
              allIndicatorNames={allIndicatorNames}
              stickyColumn={true}
              showRowCount={true}
              showTotals={true}
              highlightMax={true}
              highlightMin={true}
              sortable={true}
              exportable={true}
            />
          )}
        </div>
      </div>
    </div>
  );
}
