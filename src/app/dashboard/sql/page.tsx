'use client';

import { useState, useEffect } from 'react';
import SQLEditor from '@/components/sql/SQLEditor';
import { QueryExamples } from '@/components/sql/QueryExamples';
import { ResultsTable } from '@/components/sql/ResultsTable';
import SavedQueries from '@/components/sql/SavedQueries';
import type { SavedQuery } from '@/components/sql/SavedQueries';
import { SimpleEmptyState } from '@/components/common/SimpleEmptyState';
import { AlertBox } from '@/components/common/AlertBox';
import { Database, Clock, AlertCircle } from 'lucide-react';
import { dataStore } from '@/lib/data-store';
import { getSQLConnector } from '@/lib/sql-connector';
import type { SQLResult } from '@/types/dashboard';

export default function SQLPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SQLResult | null>(null);
  const [error, setError] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);

  useEffect(() => {
    // Загружаем сохраненные запросы
    const saved = localStorage.getItem('savedSQLQueries');
    if (saved) {
      setSavedQueries(JSON.parse(saved));
    }

    // Получаем доступные колонки
    const headers = dataStore.getHeaders();
    setAvailableColumns(headers);
  }, []);

  const executeQuery = () => {
    setError('');
    setIsExecuting(true);
    setExecutionTime(null);
    
    try {
      // Проверяем наличие данных
      if (!dataStore.hasData()) {
        setError('Нет загруженных данных. Загрузите Excel файл на главной странице.');
        setResults(null);
        setIsExecuting(false);
        return;
      }

      // Валидация запроса
      const connector = getSQLConnector();
      const validation = connector.validateQuery(query);
      
      if (!validation.valid) {
        setError(validation.error || 'Невалидный SQL запрос');
        setResults(null);
        setIsExecuting(false);
        return;
      }

      // Выполняем запрос
      const rawData = dataStore.getRawData();
      const headers = dataStore.getHeaders();
      
      const result = connector.executeQuery(query, rawData, headers);
      
      if (result.success && result.data) {
        setResults({
          headers: result.data.headers,
          rows: result.data.rows
        });
        setExecutionTime(result.executionTime || null);
      } else {
        setError(result.error || 'Ошибка выполнения запроса');
        setResults(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка выполнения запроса');
      setResults(null);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleLoadQuery = (savedQuery: SavedQuery) => {
    setQuery(savedQuery.sql);
    
    // Обновляем статистику использования
    const updated = savedQueries.map(q =>
      q.id === savedQuery.id
        ? { ...q, lastUsed: Date.now(), usageCount: q.usageCount + 1 }
        : q
    );
    setSavedQueries(updated);
    localStorage.setItem('savedSQLQueries', JSON.stringify(updated));
  };

  const handleDeleteQuery = (id: string) => {
    const updated = savedQueries.filter(q => q.id !== id);
    setSavedQueries(updated);
    localStorage.setItem('savedSQLQueries', JSON.stringify(updated));
  };

  const hasData = dataStore.hasData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">SQL запросы</h1>
        <p className="text-gray-600">Создавайте виртуальные таблицы с помощью SQL запросов</p>
      </div>

      {!hasData && (
        <AlertBox
          type="warning"
          icon={AlertCircle}
          title="Нет загруженных данных"
          description="Загрузите Excel файл на главной странице, чтобы начать работу с SQL запросами"
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Редактор запросов */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Database className="w-5 h-5 text-gray-500 mr-2" />
                <h2 className="text-lg font-semibold">Редактор запросов</h2>
              </div>
              {executionTime !== null && (
                <div className="flex items-center text-sm text-gray-500">
                  <Clock className="w-4 h-4 mr-1" />
                  <span>{executionTime.toFixed(2)} мс</span>
                </div>
              )}
            </div>
            
            <SQLEditor
              value={query}
              onChange={setQuery}
              onExecute={executeQuery}
              isExecuting={isExecuting}
              availableColumns={availableColumns}
            />
            
            {error && (
              <AlertBox
                type="error"
                icon={AlertCircle}
                title="Ошибка выполнения"
                description={error}
                className="mt-4"
              />
            )}
          </div>

          {/* Результаты */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">
              Результаты
              {results && results.rows.length > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({results.rows.length} строк)
                </span>
              )}
            </h2>
            <ResultsTable results={results} />
          </div>
        </div>

        {/* Боковая панель */}
        <div className="space-y-6">
          {/* Сохраненные запросы */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Сохраненные запросы</h2>
            <SavedQueries
              queries={savedQueries}
              onLoad={handleLoadQuery}
              onDelete={handleDeleteQuery}
            />
          </div>

          {/* Примеры */}
          <div className="bg-white rounded-lg shadow p-6">
            <QueryExamples onSelectExample={setQuery} />
          </div>
        </div>
      </div>
    </div>
  );
}
