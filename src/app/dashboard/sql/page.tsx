'use client';

import { useEffect, useState, useMemo } from 'react';
import { getExcelData } from '@/lib/storage';
import { SQLEngine } from '@/lib/sql-engine';
import { SheetData, ExcelRow } from '@/types';
import { 
  FileSpreadsheet,
  Database,
  AlertCircle,
  Download,
  Table as TableIcon,
  BarChart3,
} from 'lucide-react';
import Link from 'next/link';
import Loader from '@/components/loader';
import EmptyState from '@/components/dashboard/EmptyState';
import SQLEditor from '@/components/sql/SQLEditor';
import SavedQueries, { SavedQuery } from '@/components/sql/SavedQueries';
import SummaryTable from '@/components/dashboard/SummaryTable';

export default function SQLQueryPage() {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sql, setSQL] = useState('SELECT * FROM data LIMIT 100');
  const [result, setResult] = useState<ExcelRow[]>([]);
  const [error, setError] = useState<string>('');
  const [executing, setExecuting] = useState(false);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [queryName, setQueryName] = useState('');
  const [activeTab, setActiveTab] = useState<'editor' | 'saved'>('editor');

  useEffect(() => {
    const data = getExcelData();
    if (data) setSheets(data);

    const saved = localStorage.getItem('sqlQueries');
    if (saved) setSavedQueries(JSON.parse(saved));

    setLoading(false);
  }, []);

  const sqlEngine = useMemo(() => {
    if (!sheets || sheets.length === 0) return null;
    return new SQLEngine(sheets[0].rows, sheets[0].headers);
  }, [sheets]);

  const executeQuery = () => {
    if (!sqlEngine) return;

    setExecuting(true);
    setError('');

    try {
      const queryResult = sqlEngine.executeQuery(sql);
      setResult(queryResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка выполнения запроса');
      setResult([]);
    } finally {
      setExecuting(false);
    }
  };

  const saveQuery = () => {
    if (!queryName.trim()) {
      alert('Введите название запроса');
      return;
    }

    const newQuery: SavedQuery = {
      id: Date.now().toString(),
      name: queryName,
      sql,
      createdAt: Date.now(),
      usageCount: 0,
    };

    const updated = [newQuery, ...savedQueries];
    setSavedQueries(updated);
    localStorage.setItem('sqlQueries', JSON.stringify(updated));
    
    setShowSaveDialog(false);
    setQueryName('');
    alert('Запрос сохранён!');
  };

  const loadQuery = (query: SavedQuery) => {
    setSQL(query.sql);
    setActiveTab('editor');
    
    // Увеличиваем счётчик использования
    const updated = savedQueries.map(q => 
      q.id === query.id 
        ? { ...q, usageCount: q.usageCount + 1, lastUsed: Date.now() }
        : q
    );
    setSavedQueries(updated);
    localStorage.setItem('sqlQueries', JSON.stringify(updated));
  };

  const deleteQuery = (id: string) => {
    const updated = savedQueries.filter(q => q.id !== id);
    setSavedQueries(updated);
    localStorage.setItem('sqlQueries', JSON.stringify(updated));
  };

  const exportResults = () => {
    if (result.length === 0) return;

    const headers = Object.keys(result[0]);
    const rows = result.map(row => headers.map(h => row[h]));

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `query_result_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Шаблоны запросов
  const queryTemplates = [
    {
      name: 'Выбрать все',
      sql: 'SELECT * FROM data LIMIT 100'
    },
    {
      name: 'Агрегация',
      sql: 'SELECT column1, COUNT(*) AS count, SUM(column2) AS total\nFROM data\nGROUP BY column1'
    },
    {
      name: 'Фильтрация',
      sql: 'SELECT * FROM data\nWHERE column1 > 100\nORDER BY column2 DESC\nLIMIT 50'
    },
    {
      name: 'Топ значений',
      sql: 'SELECT column1, COUNT(*) AS count\nFROM data\nGROUP BY column1\nORDER BY count DESC\nLIMIT 10'
    },
  ];

  if (loading) {
    return <Loader title="Загрузка SQL редактора..." />;
  }

  if (!sheets || sheets.length === 0) {
    return (
      <EmptyState
        icon={FileSpreadsheet}
        title="Нет загруженных данных"
        description="Загрузите Excel или CSV файл для работы с SQL"
        actionLabel="Загрузить данные"
        actionHref="/"
      />
    );
  }

  const resultHeaders = result.length > 0 ? Object.keys(result[0]) : [];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Заголовок */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent">
            SQL Query Builder
          </h1>
          <p className="text-gray-600">
            Создавайте виртуальные таблицы с помощью SQL запросов
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Database size={18} />
          <span>
            <strong>{sheets[0].rows.length}</strong> записей • 
            <strong className="ml-1">{sheets[0].headers.length}</strong> колонок
          </span>
        </div>
      </div>

      {/* Табы */}
      <div className="bg-white rounded-xl shadow-lg">
        <div className="border-b border-gray-200">
          <div className="flex gap-2 p-2">
            <button
              onClick={() => setActiveTab('editor')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                activeTab === 'editor'
                  ? 'bg-gradient-to-r from-green-600 to-teal-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Database size={18} />
              SQL редактор
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                activeTab === 'saved'
                  ? 'bg-gradient-to-r from-green-600 to-teal-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <TableIcon size={18} />
              Сохранённые ({savedQueries.length})
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'editor' ? (
            <div className="space-y-6">
              {/* Шаблоны запросов */}
              <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-lg p-4 border-2 border-green-200">
                <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <BarChart3 size={18} className="text-green-600" />
                  Быстрые шаблоны:
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                  {queryTemplates.map((template) => (
                    <button
                      key={template.name}
                      onClick={() => setSQL(template.sql)}
                      className="px-4 py-2 bg-white hover:bg-green-100 border-2 border-green-300 rounded-lg text-sm font-medium text-gray-700 transition-colors text-left"
                    >
                      {template.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* SQL редактор */}
              <SQLEditor
                value={sql}
                onChange={setSQL}
                onExecute={executeQuery}
                onSave={() => setShowSaveDialog(true)}
                availableColumns={sheets[0].headers}
                isExecuting={executing}
              />

              {/* Ошибка */}
              {error && (
                <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle size={24} className="text-red-600 flex-shrink-0" />
                  <div>
                    <h4 className="font-bold text-red-900 mb-1">Ошибка выполнения запроса</h4>
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                </div>
              )}

              {/* Результаты */}
              {result.length > 0 && (
                <div className="space-y-4">
                  {/* Статистика */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="font-semibold text-gray-900">
                        Результат: {result.length} записей
                      </span>
                      <span className="text-gray-600">
                        {resultHeaders.length} колонок
                      </span>
                    </div>
                    <button
                      onClick={exportResults}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 text-sm font-semibold transition-colors"
                    >
                      <Download size={16} />
                      Экспорт CSV
                    </button>
                  </div>

                  {/* Таблица результатов */}
                  <div className="bg-white rounded-xl shadow-lg overflow-hidden border-2 border-green-200">
                    <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gradient-to-r from-green-50 to-teal-50 sticky top-0 z-10">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider bg-green-100">
                              #
                            </th>
                            {resultHeaders.map((header) => (
                              <th
                                key={header}
                                className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider"
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {result.map((row, idx) => (
                            <tr key={idx} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-semibold bg-gray-50">
                                {idx + 1}
                              </td>
                              {resultHeaders.map((header) => {
                                const value = row[header];
                                return (
                                  <td
                                    key={header}
                                    className="px-6 py-3 whitespace-nowrap text-sm text-gray-900"
                                  >
                                    {typeof value === 'number'
                                      ? value.toFixed(2)
                                      : String(value)}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Подсказка */}
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                    <strong>💡 Совет:</strong> Результаты запроса можно экспортировать в CSV и использовать 
                    как источник данных для создания новых групп показателей.
                  </div>
                </div>
              )}

              {/* Пустое состояние результатов */}
              {!error && result.length === 0 && !executing && (
                <div className="bg-gray-50 rounded-xl p-12 text-center border-2 border-dashed border-gray-300">
                  <Database size={64} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-lg text-gray-600 mb-2">Результатов пока нет</p>
                  <p className="text-sm text-gray-500">
                    Введите SQL запрос и нажмите &quot;Выполнить&quot; или Ctrl+Enter
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Вкладка сохранённых запросов */
            <SavedQueries
              queries={savedQueries}
              onLoad={loadQuery}
              onDelete={deleteQuery}
            />
          )}
        </div>
      </div>

      {/* Диалог сохранения запроса */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Сохранить запрос</h3>
            <input
              type="text"
              value={queryName}
              onChange={(e) => setQueryName(e.target.value)}
              placeholder="Название запроса..."
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveQuery();
                if (e.key === 'Escape') setShowSaveDialog(false);
              }}
            />
            <div className="flex gap-3">
              <button
                onClick={saveQuery}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
              >
                Сохранить
              </button>
              <button
                onClick={() => {
                  setShowSaveDialog(false);
                  setQueryName('');
                }}
                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg font-semibold transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Справочная информация */}
      <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-xl shadow-lg p-6 border-2 border-green-200">
        <h3 className="text-lg font-bold text-gray-900 mb-4">📚 Примеры использования</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-4 border border-green-300">
            <h4 className="font-semibold text-green-900 mb-2">Простая выборка:</h4>
            <pre className="text-xs bg-gray-900 text-green-400 p-2 rounded overflow-x-auto">
{`SELECT column1, column2, column3
FROM data
WHERE column1 > 100
LIMIT 50`}
            </pre>
          </div>

          <div className="bg-white rounded-lg p-4 border border-green-300">
            <h4 className="font-semibold text-green-900 mb-2">Агрегация и группировка:</h4>
            <pre className="text-xs bg-gray-900 text-green-400 p-2 rounded overflow-x-auto">
{`SELECT category, 
  COUNT(*) AS count,
  AVG(price) AS avg_price
FROM data
GROUP BY category`}
            </pre>
          </div>

          <div className="bg-white rounded-lg p-4 border border-green-300">
            <h4 className="font-semibold text-green-900 mb-2">Вычисляемые поля:</h4>
            <pre className="text-xs bg-gray-900 text-green-400 p-2 rounded overflow-x-auto">
{`SELECT name,
  price * quantity AS total,
  price * 0.8 AS discount_price
FROM data`}
            </pre>
          </div>

          <div className="bg-white rounded-lg p-4 border border-green-300">
            <h4 className="font-semibold text-green-900 mb-2">Сортировка и лимит:</h4>
            <pre className="text-xs bg-gray-900 text-green-400 p-2 rounded overflow-x-auto">
{`SELECT *
FROM data
ORDER BY column1 DESC
LIMIT 10`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
