'use client';

import { SimpleEmptyState } from '@/components/common/SimpleEmptyState';
import { Database } from 'lucide-react';
import type { SQLResult } from '@/types/dashboard';

interface ResultsTableProps {
  results: SQLResult | null;
  maxRows?: number;
}

/**
 * Форматирует значение для отображения в таблице
 */
function formatValue(value: string | number | boolean | null): string {
  if (value === null || value === undefined) {
    return '—';
  }
  if (typeof value === 'boolean') {
    return value ? 'Да' : 'Нет';
  }
  if (typeof value === 'number') {
    return value.toLocaleString('ru-RU', { 
      minimumFractionDigits: 0,
      maximumFractionDigits: 2 
    });
  }
  return String(value);
}

export function ResultsTable({ results, maxRows = 1000 }: ResultsTableProps) {
  if (!results || results.rows.length === 0) {
    return (
      <SimpleEmptyState
        icon={Database}
        title="Результатов пока нет"
        description="Введите SQL запрос и нажмите 'Выполнить' или Ctrl+Enter"
      />
    );
  }

  const displayRows = results.rows.slice(0, maxRows);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              #
            </th>
            {results.headers.map((header) => (
              <th 
                key={header} 
                className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {displayRows.map((row, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              <td className="px-4 py-2 text-sm text-gray-500">{idx + 1}</td>
              {results.headers.map((header) => {
                const value = row[header];
                return (
                  <td key={header} className="px-4 py-2 text-sm text-gray-900">
                    {formatValue(value)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {results.rows.length > maxRows && (
        <div className="text-center py-3 text-sm text-gray-500 bg-gray-50">
          Показано {maxRows} из {results.rows.length} строк
        </div>
      )}
    </div>
  );
}
