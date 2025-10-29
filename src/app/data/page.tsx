'use client';

import { useEffect, useState, useMemo } from 'react';
import { getExcelData } from '@/lib/storage';
import { SheetData } from '@/types';
import { 
  Search, 
  Download, 
  ChevronDown, 
  ChevronUp, 
  Eye, 
  EyeOff, 
  BarChart3,
  Filter,
  X,
  Copy,
  Check,
  Settings,
  List,
  Grid,
} from 'lucide-react';

interface ColumnVisibility {
  [key: string]: boolean;
}

interface ColumnStats {
  sum: number;
  avg: number;
  min: number;
  max: number;
  count: number;
}

type ViewMode = 'table' | 'cards';

export default function DataPage() {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [selectedSheet, setSelectedSheet] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>({});
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [copied, setCopied] = useState(false);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const data = getExcelData();
    if (data && data.length > 0) {
      setSheets(data);
      
      // Инициализируем видимость колонок
      const initialVisibility: ColumnVisibility = {};
      data[0].headers.forEach(header => {
        initialVisibility[header] = true;
      });
      setColumnVisibility(initialVisibility);
    }
    setLoading(false);
  }, []);

  const currentSheet = sheets[selectedSheet];

  // Видимые колонки
  const visibleHeaders = useMemo(() => {
    if (!currentSheet) return [];
    return currentSheet.headers.filter(h => columnVisibility[h] !== false);
  }, [currentSheet, columnVisibility]);

  // Фильтрация и сортировка
  const filteredAndSortedRows = useMemo(() => {
    if (!currentSheet) return [];

    let filtered = currentSheet.rows;

    // Поиск
    if (searchTerm) {
      filtered = filtered.filter((row) =>
        Object.values(row).some((value) =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Фильтры по колонкам
    Object.entries(columnFilters).forEach(([column, filterValue]) => {
      if (filterValue) {
        filtered = filtered.filter(row =>
          String(row[column]).toLowerCase().includes(filterValue.toLowerCase())
        );
      }
    });

    // Сортировка
    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }

        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        return sortDirection === 'asc'
          ? aStr.localeCompare(bStr)
          : bStr.localeCompare(aStr);
      });
    }

    return filtered;
  }, [currentSheet, searchTerm, sortColumn, sortDirection, columnFilters]);

  // Пагинация
  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredAndSortedRows.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredAndSortedRows, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(filteredAndSortedRows.length / rowsPerPage);

  // Статистика по выбранным колонкам
  const columnStats = useMemo(() => {
    if (!currentSheet || selectedColumns.size === 0) return null;

    const stats: Record<string, ColumnStats> = {};
    
    selectedColumns.forEach(column => {
      const numericValues = filteredAndSortedRows
        .map(row => row[column])
        .filter(val => typeof val === 'number') as number[];

      if (numericValues.length > 0) {
        stats[column] = {
          sum: numericValues.reduce((a, b) => a + b, 0),
          avg: numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
          min: Math.min(...numericValues),
          max: Math.max(...numericValues),
          count: numericValues.length,
        };
      }
    });

    return Object.keys(stats).length > 0 ? stats : null;
  }, [currentSheet, selectedColumns, filteredAndSortedRows]);

  // Обработчики
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const toggleColumnVisibility = (column: string) => {
    setColumnVisibility(prev => ({
      ...prev,
      [column]: !prev[column],
    }));
  };

  const toggleColumnSelection = (column: string) => {
    setSelectedColumns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(column)) {
        newSet.delete(column);
      } else {
        newSet.add(column);
      }
      return newSet;
    });
  };

  const exportToCSV = (filteredOnly = false) => {
    if (!currentSheet) return;

    const dataToExport = filteredOnly ? filteredAndSortedRows : currentSheet.rows;
    const headers = visibleHeaders;
    
    const csvContent = [
      headers.join(','),
      ...dataToExport.map(row =>
        headers.map(header => {
          const value = row[header];
          const stringValue = String(value);
          return stringValue.includes(',') ? `"${stringValue}"` : stringValue;
        }).join(',')
      ),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${currentSheet.sheetName}_${filteredOnly ? 'filtered_' : ''}${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const copyToClipboard = async () => {
    if (!currentSheet) return;

    const text = [
      visibleHeaders.join('\t'),
      ...paginatedRows.map(row =>
        visibleHeaders.map(header => row[header]).join('\t')
      ),
    ].join('\n');

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка данных...</p>
        </div>
      </div>
    );
  }

  if (!sheets || sheets.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-xl text-gray-600">Нет загруженных данных</p>
      </div>
    );
  }

  return (
    <div className="max-w-full mx-auto px-4">
      {/* Заголовок */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Просмотр данных</h1>
        <p className="text-gray-600">
          Всего записей: {currentSheet.rows.length} | Отображено: {filteredAndSortedRows.length}
        </p>
      </div>

      {/* Панель инструментов */}
      <div className="bg-white rounded-xl shadow-lg p-4 mb-6 space-y-4">
        {/* Строка 1: Основные действия */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Поиск */}
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Поиск по всем колонкам..."
              className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Режим просмотра */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded transition-colors ${
                viewMode === 'table' ? 'bg-white shadow' : 'hover:bg-gray-200'
              }`}
              title="Таблица"
            >
              <List size={18} />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 rounded transition-colors ${
                viewMode === 'cards' ? 'bg-white shadow' : 'hover:bg-gray-200'
              }`}
              title="Карточки"
            >
              <Grid size={18} />
            </button>
          </div>

          {/* Фильтры */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors ${
              showFilters ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            <Filter size={18} />
            Фильтры
          </button>

          {/* Настройки колонок */}
          <button
            onClick={() => setShowColumnSettings(!showColumnSettings)}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2 font-medium transition-colors"
          >
            <Settings size={18} />
            Колонки
          </button>

          {/* Экспорт */}
          <div className="relative group">
            <button className="px-4 py-2 bg-green-600 text-white rounded-lg flex items-center gap-2 font-medium hover:bg-green-700 transition-colors">
              <Download size={18} />
              Экспорт
            </button>
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button
                onClick={() => exportToCSV(false)}
                className="w-full text-left px-4 py-2 hover:bg-gray-50 rounded-t-lg"
              >
                Все данные
              </button>
              <button
                onClick={() => exportToCSV(true)}
                className="w-full text-left px-4 py-2 hover:bg-gray-50 rounded-b-lg"
              >
                Только отфильтрованные
              </button>
            </div>
          </div>

          {/* Копировать */}
          <button
            onClick={copyToClipboard}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg flex items-center gap-2 font-medium hover:bg-purple-700 transition-colors"
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
            {copied ? 'Скопировано!' : 'Копировать'}
          </button>
        </div>
        {/* Фильтры по колонкам */}
        {showFilters && (
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Фильтры по колонкам</h3>
              <button
                onClick={() => setColumnFilters({})}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Сбросить все
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {visibleHeaders.map(header => (
                <div key={header}>
                  <label className="block text-xs text-gray-600 mb-1">{header}</label>
                  <input
                    type="text"
                    value={columnFilters[header] || ''}
                    onChange={(e) => setColumnFilters(prev => ({
                      ...prev,
                      [header]: e.target.value,
                    }))}
                    placeholder="Фильтр..."
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Настройки колонок */}
        {showColumnSettings && (
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Управление колонками</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const newVisibility: ColumnVisibility = {};
                    currentSheet.headers.forEach(h => newVisibility[h] = true);
                    setColumnVisibility(newVisibility);
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Показать все
                </button>
                <button
                  onClick={() => {
                    const newVisibility: ColumnVisibility = {};
                    currentSheet.headers.forEach(h => newVisibility[h] = false);
                    setColumnVisibility(newVisibility);
                  }}
                  className="text-sm text-gray-600 hover:text-gray-700"
                >
                  Скрыть все
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {currentSheet.headers.map(header => (
                <label
                  key={header}
                  className="flex items-center gap-2 p-2 bg-white rounded border border-gray-200 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={columnVisibility[header] !== false}
                    onChange={() => toggleColumnVisibility(header)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm truncate">{header}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Статистика по выбранным колонкам */}
      {columnStats && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl shadow-lg p-4 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <BarChart3 size={20} />
            Статистика по выбранным колонкам
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(columnStats).map(([column, stats]) => (
              <div key={column} className="bg-white rounded-lg p-4 border border-gray-200">
                <h4 className="font-semibold text-gray-900 mb-2">{column}</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Сумма:</span>
                    <span className="font-semibold">{stats.sum.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Среднее:</span>
                    <span className="font-semibold">{stats.avg.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Мин:</span>
                    <span className="font-semibold">{stats.min.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Макс:</span>
                    <span className="font-semibold">{stats.max.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1">
                    <span className="text-gray-600">Записей:</span>
                    <span className="font-semibold">{stats.count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Таблица или карточки */}
      {viewMode === 'table' ? (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {/* <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      className="w-4 h-4"
                      title="Выбрать все колонки для статистики"
                    />
                  </th> */}
                  {visibleHeaders.map((header) => (
                    <th
                      key={header}
                      onClick={() => handleSort(header)}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>{header}</span>
                        <div className="flex flex-col">
                          <ChevronUp
                            size={14}
                            className={`${
                              sortColumn === header && sortDirection === 'asc'
                                ? 'text-blue-600'
                                : 'text-gray-300'
                            }`}
                          />
                          <ChevronDown
                            size={14}
                            className={`-mt-1 ${
                              sortColumn === header && sortDirection === 'desc'
                                ? 'text-blue-600'
                                : 'text-gray-300'
                            }`}
                          />
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    {/* <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        className="w-4 h-4"
                        title="Выбрать для статистики"
                      />
                    </td> */}
                    {visibleHeaders.map((header) => (
                      <td
                        key={header}
                        onClick={() => toggleColumnSelection(header)}
                        className={`px-6 py-4 whitespace-nowrap text-sm ${
                          selectedColumns.has(header)
                            ? 'bg-blue-50 font-semibold text-blue-900'
                            : 'text-gray-900'
                        } cursor-pointer`}
                      >
                        {typeof row[header] === 'number'
                          ? row[header].toLocaleString('ru-RU')
                          : row[header]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Режим карточек */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedRows.map((row, idx) => (
            <div
              key={idx}
              className="bg-white rounded-lg shadow-lg p-4 hover:shadow-xl transition-shadow border border-gray-200"
            >
              <div className="space-y-2">
                {visibleHeaders.map((header) => (
                  <div key={header} className="flex justify-between items-start">
                    <span className="text-sm font-medium text-gray-600 mr-2">
                      {header}:
                    </span>
                    <span className="text-sm text-gray-900 text-right">
                      {typeof row[header] === 'number'
                        ? row[header].toLocaleString('ru-RU')
                        : row[header]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Пагинация */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 bg-white rounded-xl shadow-lg p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Строк на странице:</span>
          <select
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            Страница {currentPage} из {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ««
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              «
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              »
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              »»
            </button>
          </div>
        </div>

        <div className="text-sm text-gray-600">
          Показано {((currentPage - 1) * rowsPerPage) + 1} - {Math.min(currentPage * rowsPerPage, filteredAndSortedRows.length)} из {filteredAndSortedRows.length}
        </div>
      </div>
    </div>
  );
}
