'use client';

import { useEffect, useState, useMemo } from 'react';
import { getData } from '../actions/excel';
import { applyFilters, evaluateFormula } from '@/lib/excel-parser';
import KPICard from '@/components/kpi-card';
import GroupSummaryTable from '@/components/group-summary-table';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from '@/lib/recharts';
import { AlertCircle, BarChart3, Printer } from 'lucide-react';
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
}

interface ChartDataPoint {
  name: string;
  [key: string]: string | number;
}

export default function DashboardPage() {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const data = await getData();
      if (data) {
        setSheets(data);
      }
      setLoading(false);
    }
    fetchData();

    const savedGroups = localStorage.getItem('analyticsGroups');
    if (savedGroups) {
      setGroups(JSON.parse(savedGroups));
    }
  }, []);

  const groupResults = useMemo(() => {
    if (!sheets || sheets.length === 0 || groups.length === 0) return [];

    return groups.map((group) => {
      const filteredData = applyFilters(sheets[0].rows, group.filters);
      
      const indicators = group.indicators.map((indicator) => ({
        name: indicator.name,
        formula: indicator.formula,
        value: evaluateFormula(indicator.formula, filteredData, sheets[0].headers),
      }));

      return {
        groupId: group.id,
        groupName: group.name,
        filters: group.filters,
        indicators,
        rowCount: filteredData.length,
      };
    });
  }, [sheets, groups]);

  const chartData = useMemo(() => {
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

  // Экспорт в CSV
  const exportToCSV = () => {
    if (groupResults.length === 0) return;

    const headers = ['Группа', 'Показатель', 'Формула', 'Значение', 'Количество строк'];
    const rows = groupResults.flatMap((group) =>
      group.indicators.map((indicator, index) => [
        index === 0 ? group.groupName : '',
        indicator.name,
        indicator.formula,
        indicator.value.toFixed(2),
        index === 0 ? group.rowCount.toString() : '',
      ])
    );

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    // Добавляем UTF-8 BOM для корректного отображения кириллицы
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `dashboard_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Функция печати
  const handlePrint = () => {
    window.print();
  };

  // Цвета для графиков
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f43f5e', '#14b8a6'];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка дашборда...</p>
        </div>
      </div>
    );
  }

  if (!sheets || sheets.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 max-w-md mx-auto">
          <AlertCircle className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
          <p className="text-xl text-gray-800 mb-2">Нет загруженных данных</p>
          <p className="text-gray-600">
            Загрузите Excel файл на главной странице, чтобы начать работу.
          </p>
        </div>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 max-w-md mx-auto">
          <BarChart3 className="w-12 h-12 text-blue-600 mx-auto mb-4" />
          <p className="text-xl text-gray-800 mb-2">Нет групп показателей</p>
          <p className="text-gray-600 mb-4">
            Создайте группы показателей для отображения дашборда.
          </p>
          <a
            href="/groups"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Перейти к созданию групп
          </a>
        </div>
      </div>
    );
  }

  // Общая статистика
  const totalIndicators = groupResults.reduce((sum, g) => sum + g.indicators.length, 0);
  const avgValue = groupResults.length > 0
    ? groupResults.reduce((sum, g) => 
        sum + g.indicators.reduce((s, i) => s + i.value, 0), 0
      ) / totalIndicators
    : 0;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Кнопка печати - скрывается при печати */}
      <div className="mb-6 flex items-center justify-between no-print">
        <div>
          <h1 className="text-3xl font-bold mb-2">Дашборд показателей</h1>
          <p className="text-gray-600">
            Визуализация и анализ групповых показателей
          </p>
        </div>
        <button
          onClick={handlePrint}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Printer size={20} />
          Печать
        </button>
      </div>

      {/* Заголовок для печати - показывается только при печати */}
      <div className="print-only mb-6">
        <h1 className="text-3xl font-bold mb-2">Дашборд показателей</h1>
        <p className="text-gray-600">
          Дата формирования: {new Date().toLocaleDateString('ru-RU', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </p>
      </div>

      {/* KPI карточки */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <KPICard
          label="Всего групп"
          value={groups.length}
          color="blue"
          status="neutral"
        />
        <KPICard
          label="Показателей"
          value={totalIndicators}
          color="green"
          status="neutral"
        />
        <KPICard
          label="Среднее значение"
          value={avgValue}
          color="purple"
          status="neutral"
        />
        <KPICard
          label="Строк обработано"
          value={groupResults.reduce((sum, g) => sum + g.rowCount, 0)}
          color="orange"
          status="neutral"
        />
      </div>

      {/* Графики */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Столбчатая диаграмма */}
        <div className="bg-white rounded-lg shadow-lg p-6 print-break-inside-avoid">
          <h3 className="text-lg font-semibold mb-4">Сравнение показателей по группам</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              {groupResults[0]?.indicators.map((indicator, index) => (
                <Bar
                  key={indicator.name}
                  dataKey={indicator.name}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Круговая диаграмма */}
        <div className="bg-white rounded-lg shadow-lg p-6 print-break-inside-avoid">
          <h3 className="text-lg font-semibold mb-4">Распределение по группам</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent as number * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => value.toFixed(2)} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Линейный график - полная ширина */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-8 print-break-inside-avoid">
        <h3 className="text-lg font-semibold mb-4">Динамика показателей</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            {groupResults[0]?.indicators.map((indicator, index) => (
              <Line
                key={indicator.name}
                type="monotone"
                dataKey={indicator.name}
                stroke={COLORS[index % COLORS.length]}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
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

      {/* Сводная таблица */}
      <div className="print-break-before">
        <GroupSummaryTable groups={groupResults} onExport={exportToCSV} />
      </div>
    </div>
  );
}
