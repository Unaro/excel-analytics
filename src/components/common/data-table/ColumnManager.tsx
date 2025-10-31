// src/components/common/data-table/ColumnManager.tsx
'use client';

import { ColumnVisibility } from '@/types/data-table';

interface ColumnManagerProps {
  columns: string[];
  visibility: ColumnVisibility;
  onVisibilityChange: (visibility: ColumnVisibility) => void;
}

export function ColumnManager({ columns, visibility, onVisibilityChange }: ColumnManagerProps) {
  const toggleColumn = (column: string) => {
    onVisibilityChange({
      ...visibility,
      [column]: !visibility[column],
    });
  };

  const showAll = () => {
    const newVisibility: ColumnVisibility = {};
    columns.forEach(col => newVisibility[col] = true);
    onVisibilityChange(newVisibility);
  };

  const hideAll = () => {
    const newVisibility: ColumnVisibility = {};
    columns.forEach(col => newVisibility[col] = false);
    onVisibilityChange(newVisibility);
  };

  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">Управление колонками</h3>
        <div className="flex gap-2">
          <button
            onClick={showAll}
            className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
          >
            Показать все
          </button>
          <button
            onClick={hideAll}
            className="text-sm text-gray-600 hover:text-gray-700 transition-colors"
          >
            Скрыть все
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {columns.map(column => (
          <label
            key={column}
            className="flex items-center gap-2 p-2 bg-white rounded border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
          >
            <input
              type="checkbox"
              checked={visibility[column] !== false}
              onChange={() => toggleColumn(column)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm truncate">{column}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
