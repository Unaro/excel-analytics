'use client';

import { useState, useMemo } from 'react';
import { DashboardFilter } from '@/types/dashboard-builder';
import { Filter, X, Plus, ChevronDown, Search, Calendar } from 'lucide-react';
import { ExcelRow } from '@/types';

interface FilterPanelProps {
  filters: DashboardFilter[];
  availableColumns: string[];
  data: ExcelRow[];
  onFiltersChange: (filters: DashboardFilter[]) => void;
  onAddFilter: (filter: DashboardFilter) => void;
  onRemoveFilter: (filterId: string) => void;
  className?: string;
}

export default function FilterPanel({
  filters,
  availableColumns,
  data,
  onFiltersChange,
  onAddFilter,
  onRemoveFilter,
  className = '',
}: FilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAddFilter, setShowAddFilter] = useState(false);
  const [newFilterColumn, setNewFilterColumn] = useState('');
  const [newFilterType, setNewFilterType] = useState<DashboardFilter['type']>('select');

  // Получаем уникальные значения для колонки
  const getUniqueValues = (column: string): string[] => {
    const values = new Set<string>();
    data.forEach(row => {
      const value = row[column];
      if (value != null) values.add(String(value));
    });
    return Array.from(values).sort();
  };

  // Определяем тип колонки
  const getColumnType = (column: string): 'number' | 'string' | 'date' => {
    if (data.length === 0) return 'string';
    const sample = data[0][column];
    
    if (sample == null) return 'string';
    if (typeof sample === 'number') return 'number';
    if (typeof sample === 'boolean') return 'string';
    
    if (typeof sample === 'string' && /^\d{4}-\d{2}-\d{2}/.test(sample)) {
      return 'date';
    }
    
    return 'string';
  };

  const handleAddFilter = () => {
    if (!newFilterColumn) return;

    const columnType = getColumnType(newFilterColumn);
    const suggestedType = columnType === 'number' ? 'range' : 
                          columnType === 'date' ? 'date' : 'select';

    const newFilter: DashboardFilter = {
      id: Date.now().toString(),
      column: newFilterColumn,
      type: newFilterType || suggestedType,
      label: newFilterColumn,
      selectedValues: [],
    };

    onAddFilter(newFilter);
    setShowAddFilter(false);
    setNewFilterColumn('');
  };

  const updateFilter = (filterId: string, updates: Partial<DashboardFilter>) => {
    const updated = filters.map(f => 
      f.id === filterId ? { ...f, ...updates } : f
    );
    onFiltersChange(updated);
  };

  const clearAllFilters = () => {
    const cleared = filters.map(f => ({
      ...f,
      selectedValues: [],
      rangeMin: undefined,
      rangeMax: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      searchTerm: undefined,
    }));
    onFiltersChange(cleared);
  };

  const hasActiveFilters = filters.some(f => 
    (f.selectedValues && f.selectedValues.length > 0) ||
    f.rangeMin != null || f.rangeMax != null ||
    f.dateFrom || f.dateTo || f.searchTerm
  );

  return (
    <div className={`bg-white rounded-xl shadow-lg border-2 border-blue-200 overflow-hidden ${className}`}>
      <div 
        className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3 text-white">
          <Filter size={20} />
          <h3 className="font-bold">
            Фильтры дашборда
            {filters.length > 0 && (
              <span className="ml-2 text-xs bg-white/30 px-2 py-0.5 rounded-full">
                {filters.length}
              </span>
            )}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearAllFilters();
              }}
              className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded transition-colors"
            >
              Очистить
            </button>
          )}
          <ChevronDown 
            size={20} 
            className={`text-white transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-4">
          {filters.map((filter) => (
            <div key={filter.id} className="border-2 border-gray-200 rounded-lg p-3 hover:border-blue-300 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <label className="font-semibold text-gray-900 text-sm">
                  {filter.label}
                </label>
                <button
                  onClick={() => onRemoveFilter(filter.id)}
                  className="p-1 hover:bg-red-100 rounded transition-colors"
                  title="Удалить фильтр"
                >
                  <X size={16} className="text-red-600" />
                </button>
              </div>

              {filter.type === 'select' && (
                <select
                  value={filter.selectedValues?.[0] || ''}
                  onChange={(e) => updateFilter(filter.id, {
                    selectedValues: e.target.value ? [e.target.value] : []
                  })}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="">Все значения</option>
                  {getUniqueValues(filter.column).map(value => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              )}

              {filter.type === 'multiselect' && (
                <div className="max-h-48 overflow-y-auto border-2 border-gray-300 rounded-lg p-2">
                  {getUniqueValues(filter.column).map(value => (
                    <label
                      key={value}
                      className="flex items-center gap-2 p-1.5 hover:bg-blue-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={filter.selectedValues?.includes(value) || false}
                        onChange={(e) => {
                          const current = filter.selectedValues || [];
                          const updated = e.target.checked
                            ? [...current, value]
                            : current.filter(v => v !== value);
                          updateFilter(filter.id, { selectedValues: updated });
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">{value}</span>
                    </label>
                  ))}
                </div>
              )}

              {filter.type === 'range' && (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder="Мин"
                    value={filter.rangeMin || ''}
                    onChange={(e) => updateFilter(filter.id, {
                      rangeMin: e.target.value ? parseFloat(e.target.value) : undefined
                    })}
                    className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Макс"
                    value={filter.rangeMax || ''}
                    onChange={(e) => updateFilter(filter.id, {
                      rangeMax: e.target.value ? parseFloat(e.target.value) : undefined
                    })}
                    className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              )}

              {filter.type === 'date' && (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={filter.dateFrom || ''}
                    onChange={(e) => updateFilter(filter.id, { dateFrom: e.target.value })}
                    className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <input
                    type="date"
                    value={filter.dateTo || ''}
                    onChange={(e) => updateFilter(filter.id, { dateTo: e.target.value })}
                    className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              )}

              {filter.type === 'search' && (
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Поиск..."
                    value={filter.searchTerm || ''}
                    onChange={(e) => updateFilter(filter.id, { searchTerm: e.target.value })}
                    className="w-full pl-10 pr-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              )}
            </div>
          ))}

          {!showAddFilter ? (
            <button
              onClick={() => setShowAddFilter(true)}
              className="w-full px-4 py-3 border-2 border-dashed border-blue-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 text-blue-600 font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Plus size={18} />
              Добавить фильтр
            </button>
          ) : (
            <div className="border-2 border-blue-300 rounded-lg p-3 bg-blue-50">
              <div className="space-y-3">
                <select
                  value={newFilterColumn}
                  onChange={(e) => setNewFilterColumn(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Выберите колонку...</option>
                  {availableColumns
                    .filter(col => !filters.some(f => f.column === col))
                    .map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                </select>

                <select
                  value={newFilterType}
                  onChange={(e) => setNewFilterType(e.target.value as "select" | "multiselect" | "range" | "date" | "search")}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="select">Выпадающий список</option>
                  <option value="multiselect">Множественный выбор</option>
                  <option value="range">Диапазон чисел</option>
                  <option value="date">Диапазон дат</option>
                  <option value="search">Поиск по тексту</option>
                </select>

                <div className="flex gap-2">
                  <button
                    onClick={handleAddFilter}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                  >
                    Добавить
                  </button>
                  <button
                    onClick={() => {
                      setShowAddFilter(false);
                      setNewFilterColumn('');
                    }}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-semibold transition-colors"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
