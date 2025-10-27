'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getExcelData } from '@/lib/storage';
import { applyFilters, evaluateFormula } from '@/lib/excel-parser';
import KPICard from '@/components/kpi-card';
import GroupSummaryTable from '@/components/group-summary-table';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from '@/lib/recharts';
import { AlertCircle, BarChart3, Printer, ArrowLeft } from 'lucide-react';
import { SheetData } from '@/types';

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

interface ChartDataPoint {
  name: string;
  [key: string]: string | number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function DashboardOverviewPage() {
  const router = useRouter();
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [hierarchyConfig, setHierarchyConfig] = useState<string[]>([]);

  useEffect(() => {
    const data = getExcelData();
    if (data) {
      setSheets(data);
    }

    const savedGroups = localStorage.getItem('analyticsGroups');
    if (savedGroups) {
      setGroups(JSON.parse(savedGroups));
    }

    const savedConfig = localStorage.getItem('hierarchyConfig');
    if (savedConfig) {
      setHierarchyConfig(JSON.parse(savedConfig));
    }

    setLoading(false);
  }, []);

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

  const groupResults = useMemo(() => {
    if (!sheets || sheets.length === 0 || groups.length === 0) return [];

    return groups.map((group) => {
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
      
      const indicators = group.indicators.map((indicator) => ({
        name: indicator.name,
        formula: indicator.formula,
        value: evaluateFormula(indicator.formula, filteredData, sheets[0].headers),
      }));

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

  const chartData: ChartDataPoint[] = useMemo(() => {
    return groupResults.map((result) => {
      const dataPoint: ChartDataPoint = { name: result.groupName };
      result.indicators.forEach((indicator) => {
        dataPoint[indicator.name] = indicator.value;
      });
      return dataPoint;
    });
  }, [groupResults]);

  const pieChartData = useMemo(() => {
    return groupResults.map((result) => {
      const firstIndicator = result.indicators[0];
      return {
        name: result.groupName,
        value: firstIndicator ? firstIndicator.value : 0,
      };
    });
  }, [groupResults]);

  const allIndicatorNames = useMemo(() => {
    const names = new Set<string>();
    groupResults.forEach(r => r.indicators.forEach(i => names.add(i.name)));
    return Array.from(names);
  }, [groupResults]);

  const totalIndicators = useMemo(() => {
    return groupResults.reduce((sum, g) => sum + g.indicators.length, 0);
  }, [groupResults]);

  const averageValue = useMemo(() => {
    if (groupResults.length === 0) return 0;
    const total = groupResults.reduce((sum, g) => {
      return sum + g.indicators.reduce((s, i) => s + i.value, 0);
    }, 0);
    return total / totalIndicators || 0;
  }, [groupResults, totalIndicators]);

  const totalRows = useMemo(() => {
    return groupResults.reduce((sum, g) => sum + g.rowCount, 0);
  }, [groupResults]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка обзора...</p>
        </div>
      </div>
    );
  }

  if (!sheets || sheets.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertCircle size={48} className="mx-auto text-yellow-500 mb-4" />
        <p className="text-xl text-gray-600 mb-4">
          Нет загруженных данных
        </p>
        <a href="/" className="text-blue-600 hover:underline">
          Загрузить данные
        </a>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertCircle size={48} className="mx-auto text-yellow-500 mb-4" />
        <p className="text-xl text-gray-600 mb-4">
          Нет созданных групп показателей
        </p>
        <a 
          href="/groups" 
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Создать группу
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Хедер */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-3xl font-bold">Обзор показателей</h1>
          </div>
          <p className="text-gray-600 ml-12">
            Визуализация всех групп и показателей
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Printer size={18} />
          Печать
        </button>
      </div>

      {/* KPI Карточки */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 print-break-inside-avoid">
        <KPICard
          title="Всего групп"
          value={groups.length}
          icon={BarChart3}
          color="blue"
        />
        <KPICard
          title="Показателей"
          value={totalIndicators}
          icon={BarChart3}
          color="green"
        />
        <KPICard
          title="Среднее значение"
          value={averageValue.toFixed(2)}
          icon={BarChart3}
          color="purple"
        />
        <KPICard
          title="Строк обработано"
          value={totalRows}
          icon={BarChart3}
          color="orange"
        />
      </div>

      {/* Детальные карточки по группам */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {groupResults.map((result, index) => (
          <div key={result.groupId} className="bg-white rounded-lg shadow-lg p-6 print-break-inside-avoid">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              {result.groupName}
            </h3>

            {result.deepestFilter && (
              <div className="mb-3 p-2 bg-purple-50 border border-purple-200 rounded text-xs">
                <p className="text-purple-900 font-semibold">
                  🔍 {result.deepestFilter.column}: {result.deepestFilter.value}
                </p>
              </div>
            )}

            <div className="space-y-3">
              {result.indicators.map((indicator) => (
                <div key={indicator.name} className="border-l-4 pl-3" style={{ borderColor: COLORS[index % COLORS.length] }}>
                  <p className="text-sm text-gray-600">{indicator.name}</p>
                  <p className="text-2xl font-bold text-gray-800">
                    {indicator.value.toFixed(2)}
                  </p>
                </div>
              ))}
              <div className="pt-2 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  На основе {result.rowCount} записей
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Графики */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Столбчатая диаграмма */}
        <div className="bg-white rounded-lg shadow-lg p-6 print-break-inside-avoid">
          <h2 className="text-xl font-semibold mb-4">Сравнение показателей</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              {allIndicatorNames.map((name, idx) => (
                <Bar key={name} dataKey={name} fill={COLORS[idx % COLORS.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Круговая диаграмма */}
        <div className="bg-white rounded-lg shadow-lg p-6 print-break-inside-avoid">
          <h2 className="text-xl font-semibold mb-4">Распределение (первый показатель)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => entry.name}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Линейный график */}
        <div className="bg-white rounded-lg shadow-lg p-6 lg:col-span-2 print-break-inside-avoid">
          <h2 className="text-xl font-semibold mb-4">Динамика показателей</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              {allIndicatorNames.map((name, idx) => (
                <Line 
                  key={name} 
                  type="monotone" 
                  dataKey={name} 
                  stroke={COLORS[idx % COLORS.length]}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Сводная таблица */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-8 print-break-inside-avoid">
        <h2 className="text-xl font-semibold mb-4">Сводная таблица</h2>
        <GroupSummaryTable results={groupResults} />
      </div>

      {/* Дата формирования отчёта */}
      <div className="text-center text-sm text-gray-500 mb-4 print-only">
        <p>Отчёт сформирован: {new Date().toLocaleString('ru-RU')}</p>
      </div>
    </div>
  );
}
