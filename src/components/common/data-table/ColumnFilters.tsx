// src/components/common/data-table/ColumnFilters.tsx
'use client';

import { FilterConfig } from '@/types/data-table';

interface ColumnFiltersProps {
  columns: string[];
  filters: FilterConfig;
  onFiltersChange: (filters: FilterConfig) => void;
  onClear: () => void;
}

export function ColumnFilters({ 
  columns, 
  filters, 
  onFiltersChange,
  onClear 
}: ColumnFiltersProps) {
  const handleFilterChange = (column: string, value: string) => {
    onFiltersChange({
      ...filters,
      [column]: value,
    });
  };

  const hasActiveFilters = Object.values(filters).some(value => value.trim() !== '');

  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">Фильтры по колонкам</h3>
        {hasActiveFilters && (
          <button
            onClick={onClear}
            className="text-sm text-red-600 hover:text-red-700 transition-colors"
          >
            Сбросить все
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {columns.map(column => (
          <div key={column}>
            <label className="block text-xs text-gray-600 mb-1">{column}</label>
            <input
              type="text"
              value={filters[column] || ''}
              onChange={(e) => handleFilterChange(column, e.target.value)}
              placeholder="Фильтр..."
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
