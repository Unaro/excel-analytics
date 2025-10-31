// src/app/dashboard/sql/page.tsx (исправленная версия)
'use client';

import { useState, useEffect } from 'react';
import SQLEditor from '@/components/sql/SQLEditor';
import { QueryExamples } from '@/components/sql/QueryExamples';
import SavedQueries from '@/components/sql/SavedQueries';
import { SimpleEmptyState } from '@/components/common/SimpleEmptyState';
import { AlertBox } from '@/components/common/AlertBox';
import { Card } from '@/components/common/Card';
import { Database, Clock, AlertCircle } from 'lucide-react';
import { dataStore } from '@/lib/data-store';
import { getSQLConnector } from '@/lib/sql-connector';
import type { SQLResult } from '@/types/dashboard';
import { DataTable, ColumnConfig } from '@/components/common/data-table';
import { sqlSavedQueries } from '@/lib/sql-saved-queries';
import type { SavedQuery } from '@/types/sql';

export default function SQLPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SQLResult | null>(null);
  const [error, setError] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  
  // Состояния для предотвращения гидрации
  const [isClient, setIsClient] = useState(false);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    // Инициализируем только на клиенте
    setIsClient(true);
    setHasData(dataStore.hasData());
    setSavedQueries(sqlSavedQueries.load());
    setAvailableColumns(dataStore.getHeaders());
  }, []);

  const executeQuery = () => {
    setError('');
    setIsExecuting(true);
    setExecutionTime(null);

    try {
      if (!hasData) {
        setError('Нет загруженных данных. Загрузите Excel файл на главной странице.');
        setResults(null);
        return;
      }

      const connector = getSQLConnector();
      const validation = connector.validateQuery(query);
      if (!validation.valid) {
        setError(validation.error || 'Невалидный SQL запрос');
        setResults(null);
        return;
      }

      const rawData = dataStore.getRawData();
      const headers = dataStore.getHeaders();
      const result = connector.executeQuery(query, rawData, headers);

      if (result.success && result.data) {
        setResults({ headers: result.data.headers, rows: result.data.rows });
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
    const updated = sqlSavedQueries.updateUsage(savedQueries, savedQuery.id);
    setSavedQueries(updated);
  };

  const handleDeleteQuery = (id: string) => {
    const updated = sqlSavedQueries.remove(savedQueries, id);
    setSavedQueries(updated);
  };

  const handleSaveQuery = (name: string) => {
    if (!query.trim()) return;
    const updated = sqlSavedQueries.add(savedQueries, { name, sql: query });
    setSavedQueries(updated);
  };

  const handleEditQuery = (id: string, changes: { name: string; sql: string }) => {
    const updated = sqlSavedQueries.update(savedQueries, id, changes);
    setSavedQueries(updated);
  };

  // Конфиг колонок для DataTable при наличии результатов
  const columns: ColumnConfig[] = results
    ? results.headers.map((h) => ({
        key: h,
        label: h,
        type: 'string',
        sortable: true,
        filterable: true,
        align: 'left',
      }))
    : [];

  // Показываем загрузку до полной инициализации клиента
  if (!isClient) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка SQL редактора...</p>
        </div>
      </div>
    );
  }

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
          <Card
            title="Редактор запросов"
            rightBadge={
              executionTime !== null ? (
                <div className="flex items-center text-sm text-gray-500">
                  <Clock className="w-4 h-4 mr-1" />
                  <span>{executionTime.toFixed(2)} мс</span>
                </div>
              ) : undefined
            }
          >
            <SQLEditor
              value={query}
              onChange={setQuery}
              onExecute={executeQuery}
              onSave={handleSaveQuery}
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
          </Card>

          {/* Результаты */}
          <Card title="Результаты" subtitle={results ? `${results.rows.length} строк` : undefined}>
            {results && results.rows.length > 0 ? (
              <DataTable
                data={results.rows}
                columns={columns}
                enableStats={false}
                enableColumnManager={true}
                enableFilters={true}
                enableSearch={true}
                enablePagination={true}
                enableViewModes={false}
                enableCopy={true}
                enableExport={true}
                initialItemsPerPage={50}
              />
            ) : (
              <SimpleEmptyState
                icon={Database}
                title="Нет данных"
                description={error ? 'Исправьте запрос и выполните снова' : 'Выполните запрос, чтобы увидеть результат'}
              />
            )}
          </Card>
        </div>

        {/* Боковая панель */}
        <div className="space-y-6">
          <Card title="Сохраненные запросы">
            <SavedQueries
              queries={savedQueries}
              onLoad={handleLoadQuery}
              onDelete={handleDeleteQuery}
              onEdit={handleEditQuery}
            />
          </Card>

          <Card title="Примеры">
            <QueryExamples onSelectExample={setQuery} />
          </Card>
        </div>
      </div>
    </div>
  );
}
