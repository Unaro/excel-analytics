'use client';

import { useEffect, useState } from 'react';
import { getData } from '../actions/excel';
import { TrendingUp, TrendingDown, Users, FileText, BarChart3, Database } from 'lucide-react';
import { SheetData, ExcelRow } from '@/types';

interface ColumnStats {
  sum: number;
  avg: number;
  min: number;
  max: number;
  count: number;
  median: number;
}

interface TopValue {
  value: string | number | boolean | null;
  numValue: number;
}

export default function StatisticsPage() {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedColumn, setSelectedColumn] = useState('');

  useEffect(() => {
    async function fetchData() {
      const data = await getData();
      if (data) {
        setSheets(data);
        if (data[0]?.headers?.length > 0) {
          setSelectedColumn(data[0].headers[0]);
        }
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) {
    return <div>Загрузка...</div>;
  }

  if (!sheets || sheets.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-xl text-gray-600">
          Нет загруженных данных. Загрузите Excel файл на главной странице.
        </p>
      </div>
    );
  }

  const currentSheet = sheets[0];
  const totalRows = currentSheet.rows.length;
  const totalColumns = currentSheet.headers.length;

  // Вычисление статистики для выбранной колонки
  const getColumnStats = (column: string): ColumnStats => {
    const values = currentSheet.rows
      .map((row: ExcelRow) => parseFloat(String(row[column])))
      .filter((val: number) => !isNaN(val));

    if (values.length === 0) {
      return {
        sum: 0,
        avg: 0,
        min: 0,
        max: 0,
        count: 0,
        median: 0,
      };
    }

    const sum = values.reduce((a: number, b: number) => a + b, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    return { sum, avg, min, max, count: values.length, median };
  };

  const stats = selectedColumn ? getColumnStats(selectedColumn) : null;

  // Получить топ-5 значений по выбранной колонке
  const getTopValues = (column: string, limit: number = 5): TopValue[] => {
    return currentSheet.rows
      .map((row: ExcelRow) => ({
        value: row[column],
        numValue: parseFloat(String(row[column])),
      }))
      .filter((item: TopValue) => !isNaN(item.numValue))
      .sort((a: TopValue, b: TopValue) => b.numValue - a.numValue)
      .slice(0, limit);
  };

  const topValues = selectedColumn ? getTopValues(selectedColumn) : [];

  // Подсчет пустых значений
  const countEmptyValues = (): number => {
    let emptyCount = 0;
    currentSheet.rows.forEach((row: ExcelRow) => {
      currentSheet.headers.forEach((header: string) => {
        if (row[header] === null || row[header] === undefined || row[header] === '') {
          emptyCount++;
        }
      });
    });
    return emptyCount;
  };

  const emptyValues = countEmptyValues();
  const totalCells = totalRows * totalColumns;
  const fillRate = ((totalCells - emptyValues) / totalCells * 100).toFixed(1);

  return (
    <div className="max-w-7xl">
      <h1 className="text-3xl font-bold mb-6">Обзор данных и статистика</h1>

      {/* Карточки общей статистики */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <FileText size={32} className="opacity-80" />
            <div className="text-right">
              <p className="text-sm opacity-90">Всего строк</p>
              <p className="text-3xl font-bold">{totalRows}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <Database size={32} className="opacity-80" />
            <div className="text-right">
              <p className="text-sm opacity-90">Колонок</p>
              <p className="text-3xl font-bold">{totalColumns}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <BarChart3 size={32} className="opacity-80" />
            <div className="text-right">
              <p className="text-sm opacity-90">Заполненность</p>
              <p className="text-3xl font-bold">{fillRate}%</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <Users size={32} className="opacity-80" />
            <div className="text-right">
              <p className="text-sm opacity-90">Пустых ячеек</p>
              <p className="text-3xl font-bold">{emptyValues}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Детальная статистика по колонке */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Статистика по колонке</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Выберите колонку для анализа:</label>
          <select
            value={selectedColumn}
            onChange={(e) => setSelectedColumn(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          >
            {currentSheet.headers.map((header: string) => (
              <option key={header} value={header}>
                {header}
              </option>
            ))}
          </select>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-xs text-gray-600 mb-1">Сумма</p>
              <p className="text-xl font-bold text-blue-600">{stats.sum.toFixed(2)}</p>
            </div>
            
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-xs text-gray-600 mb-1">Среднее</p>
              <p className="text-xl font-bold text-green-600">{stats.avg.toFixed(2)}</p>
            </div>
            
            <div className="bg-purple-50 rounded-lg p-4">
              <p className="text-xs text-gray-600 mb-1">Медиана</p>
              <p className="text-xl font-bold text-purple-600">{stats.median.toFixed(2)}</p>
            </div>
            
            <div className="bg-orange-50 rounded-lg p-4">
              <p className="text-xs text-gray-600 mb-1">Минимум</p>
              <p className="text-xl font-bold text-orange-600">{stats.min.toFixed(2)}</p>
            </div>
            
            <div className="bg-red-50 rounded-lg p-4">
              <p className="text-xs text-gray-600 mb-1">Максимум</p>
              <p className="text-xl font-bold text-red-600">{stats.max.toFixed(2)}</p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-600 mb-1">Значений</p>
              <p className="text-xl font-bold text-gray-600">{stats.count}</p>
            </div>
          </div>
        )}
      </div>

      {/* Топ-5 значений */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold mb-4">
          Топ-5 значений: {selectedColumn}
        </h2>
        
        {topValues.length > 0 ? (
          <div className="space-y-3">
            {topValues.map((item: TopValue, index: number) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                    index === 0 ? 'bg-yellow-500' :
                    index === 1 ? 'bg-gray-400' :
                    index === 2 ? 'bg-orange-400' :
                    'bg-blue-500'
                  }`}>
                    {index + 1}
                  </div>
                  <span className="font-medium">{item.value}</span>
                </div>
                <span className="text-lg font-bold text-blue-600">
                  {item.numValue.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">
            Нет числовых данных в выбранной колонке
          </p>
        )}
      </div>

      {/* Список всех колонок */}
      <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
        <h2 className="text-xl font-semibold mb-4">Все колонки в датасете</h2>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {currentSheet.headers.map((header: string, index: number) => (
            <div
              key={index}
              className="bg-gray-100 px-3 py-2 rounded text-sm font-medium text-gray-700 hover:bg-gray-200 cursor-pointer transition-colors"
              onClick={() => setSelectedColumn(header)}
            >
              {header}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
