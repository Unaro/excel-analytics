// src/components/common/data-table/DataToolbar.tsx
'use client';

import { useState } from 'react';
import { Filter, Settings } from 'lucide-react';
import { SearchBar } from './SearchBar';
import { ViewModeToggle, ViewMode } from './ViewModeToggle';
import { ColumnFilters } from './ColumnFilters';
import { ColumnManager } from './ColumnManager';
import { ExportButton } from './ExportButton';
import { CopyButton } from './CopyButton';
import { DataRow, FilterConfig, ColumnVisibility } from '@/types/data-table';

interface DataToolbarProps {
  // Поиск
  searchTerm: string;
  onSearchChange: (term: string) => void;
  
  // Режим просмотра
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  availableViewModes?: ViewMode[];
  
  // Фильтры
  columns: string[];
  columnFilters: FilterConfig;
  onColumnFiltersChange: (filters: FilterConfig) => void;
  
  // Управление колонками
  columnVisibility: ColumnVisibility;
  onColumnVisibilityChange: (visibility: ColumnVisibility) => void;
  
  // Данные для экспорта/копирования
  data: DataRow[];
  visibleColumns: string[];
  
  // Опциональные коллбэки
  onExport?: (format: string, data: DataRow[]) => void;
  onCopy?: (data: DataRow[]) => void;
  
  // UI настройки
  className?: string;
}

export function DataToolbar({
  searchTerm,
  onSearchChange,
  viewMode,
  onViewModeChange,
  availableViewModes,
  columns,
  columnFilters,
  onColumnFiltersChange,
  columnVisibility,
  onColumnVisibilityChange,
  data,
  visibleColumns,
  onExport,
  onCopy,
  className = "",
}: DataToolbarProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [showColumnSettings, setShowColumnSettings] = useState(false);

  const clearFilters = () => {
    onColumnFiltersChange({});
  };

  const hasActiveFilters = Object.values(columnFilters).some(value => value.trim() !== '');

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Основная строка инструментов */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Поиск */}
        <SearchBar
          value={searchTerm}
          onChange={onSearchChange}
        />

        {/* Режим просмотра */}
        <ViewModeToggle
          mode={viewMode}
          onChange={onViewModeChange}
          availableModes={availableViewModes}
        />

        {/* Кнопка фильтров */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors ${
            showFilters || hasActiveFilters
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          <Filter size={18} />
          Фильтры
          {hasActiveFilters && (
            <span className="bg-white text-blue-600 text-xs px-1.5 py-0.5 rounded-full">
              {Object.values(columnFilters).filter(v => v.trim() !== '').length}
            </span>
          )}
        </button>

        {/* Кнопка управления колонками */}
        <button
          onClick={() => setShowColumnSettings(!showColumnSettings)}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors ${
            showColumnSettings 
              ? 'bg-gray-200' 
              : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          <Settings size={18} />
          Колонки
        </button>

        {/* Экспорт */}
        <ExportButton
          data={data}
          visibleColumns={visibleColumns}
          onExport={onExport}
        />

        {/* Копирование */}
        <CopyButton
          data={data}
          visibleColumns={visibleColumns}
          onCopy={onCopy}
        />
      </div>

      {/* Панель фильтров */}
      {showFilters && (
        <ColumnFilters
          columns={visibleColumns}
          filters={columnFilters}
          onFiltersChange={onColumnFiltersChange}
          onClear={clearFilters}
        />
      )}

      {/* Панель управления колонками */}
      {showColumnSettings && (
        <ColumnManager
          columns={columns}
          visibility={columnVisibility}
          onVisibilityChange={onColumnVisibilityChange}
        />
      )}
    </div>
  );
}
