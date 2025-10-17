'use client';

import { useEffect, useState, useMemo } from 'react';
import { getData } from '../actions/excel';
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download } from 'lucide-react';

export default function DataPage() {
  const [sheets, setSheets] = useState<any[]>([]);
  const [selectedSheet, setSelectedSheet] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Пагинация
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  
  // Поиск
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function fetchData() {
      const data = await getData();
      if (data) {
        setSheets(data);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  // Сброс страницы при изменении листа
  useEffect(() => {
    setCurrentPage(1);
    setSearchQuery('');
  }, [selectedSheet]);

  // Фильтрация данных по поисковому запросу
  const filteredRows = useMemo(() => {
    if (!sheets || sheets.length === 0) return [];
    
    const currentSheet = sheets[selectedSheet];
    if (!searchQuery.trim()) return currentSheet.rows;

    const query = searchQuery.toLowerCase();
    return currentSheet.rows.filter((row: any) => {
      return currentSheet.headers.some((header: string) => {
        const value = row[header];
        return value !== null && 
               value !== undefined && 
               String(value).toLowerCase().includes(query);
      });
    });
  }, [sheets, selectedSheet, searchQuery]);

  // Вычисление пагинации
  const totalPages = Math.ceil(filteredRows.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const currentRows = filteredRows.slice(startIndex, endIndex);

  // Навигация по страницам
  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  // Экспорт в CSV
  const exportToCSV = () => {
    if (!sheets || sheets.length === 0) return;
    
    const currentSheet = sheets[selectedSheet];
    const csvContent = [
      currentSheet.headers.join(','),
      ...filteredRows.map((row: any) => 
        currentSheet.headers.map((header: string) => {
          const value = row[header];
          return value !== null && value !== undefined ? `"${value}"` : '';
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${currentSheet.sheetName}_export.csv`;
    link.click();
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
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 max-w-md mx-auto">
          <p className="text-xl text-gray-800 mb-2">📊 Нет загруженных данных</p>
          <p className="text-gray-600">
            Загрузите Excel файл на главной странице, чтобы начать работу.
          </p>
        </div>
      </div>
    );
  }

  const currentSheet = sheets[selectedSheet];

  return (
    <div className="max-w-full">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Данные из Excel</h1>
        <p className="text-gray-600">
          Просмотр и анализ табличных данных с возможностью поиска и фильтрации
        </p>
      </div>

      {/* Панель управления */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Выбор листа */}
          {sheets.length > 1 && (
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">
                Лист Excel:
              </label>
              <select
                value={selectedSheet}
                onChange={(e) => setSelectedSheet(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {sheets.map((sheet, index) => (
                  <option key={index} value={index}>
                    {sheet.sheetName} ({sheet.rows.length} строк)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Поиск */}
          <div className={sheets.length > 1 ? '' : 'md:col-span-2'}>
            <label className="block text-sm font-medium mb-2 text-gray-700">
              Поиск по всем колонкам:
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Введите запрос для поиска..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Кнопка экспорта */}
          <div className="flex items-end">
            <button
              onClick={exportToCSV}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              <Download size={20} />
              Экспорт в CSV
            </button>
          </div>
        </div>

        {/* Информация о данных */}
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <div className="bg-blue-50 px-4 py-2 rounded-lg">
            <span className="text-gray-600">Всего строк:</span>
            <span className="ml-2 font-semibold text-blue-700">{currentSheet.rows.length}</span>
          </div>
          <div className="bg-green-50 px-4 py-2 rounded-lg">
            <span className="text-gray-600">Найдено:</span>
            <span className="ml-2 font-semibold text-green-700">{filteredRows.length}</span>
          </div>
          <div className="bg-purple-50 px-4 py-2 rounded-lg">
            <span className="text-gray-600">Колонок:</span>
            <span className="ml-2 font-semibold text-purple-700">{currentSheet.headers.length}</span>
          </div>
        </div>
      </div>

      {/* Таблица */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-gray-800 to-gray-700 text-white">
                <th className="px-4 py-3 text-left font-semibold text-sm sticky left-0 bg-gray-800 z-10">
                  #
                </th>
                {currentSheet.headers.map((header: string, index: number) => (
                  <th 
                    key={index} 
                    className="px-4 py-3 text-left font-semibold text-sm whitespace-nowrap"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentRows.length > 0 ? (
                currentRows.map((row: any, rowIndex: number) => (
                  <tr 
                    key={rowIndex} 
                    className={`
                      ${rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                      hover:bg-blue-50 transition-colors border-b border-gray-200
                    `}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-600 sticky left-0 bg-inherit">
                      {startIndex + rowIndex + 1}
                    </td>
                    {currentSheet.headers.map((header: string, colIndex: number) => (
                      <td 
                        key={colIndex} 
                        className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap"
                      >
                        {row[header] !== null && row[header] !== undefined 
                          ? String(row[header]) 
                          : <span className="text-gray-400 italic">—</span>
                        }
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td 
                    colSpan={currentSheet.headers.length + 1} 
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Search size={48} className="text-gray-300" />
                      <p className="text-lg font-medium">Ничего не найдено</p>
                      <p className="text-sm">Попробуйте изменить поисковый запрос</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Пагинация */}
        {filteredRows.length > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Выбор количества строк */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-700">Строк на странице:</label>
                <select
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              {/* Информация о текущей странице */}
              <div className="text-sm text-gray-700">
                Показано <span className="font-semibold">{startIndex + 1}</span> - 
                <span className="font-semibold"> {Math.min(endIndex, filteredRows.length)}</span> из 
                <span className="font-semibold"> {filteredRows.length}</span> строк
              </div>

              {/* Кнопки навигации */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => goToPage(1)}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Первая страница"
                >
                  <ChevronsLeft size={20} />
                </button>
                
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Предыдущая"
                >
                  <ChevronLeft size={20} />
                </button>

                {/* Номера страниц */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <button
                        key={i}
                        onClick={() => goToPage(pageNum)}
                        className={`
                          w-10 h-10 rounded-lg font-medium text-sm transition-colors
                          ${currentPage === pageNum
                            ? 'bg-blue-600 text-white'
                            : 'border border-gray-300 hover:bg-gray-100'
                          }
                        `}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Следующая"
                >
                  <ChevronRight size={20} />
                </button>
                
                <button
                  onClick={() => goToPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Последняя страница"
                >
                  <ChevronsRight size={20} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
