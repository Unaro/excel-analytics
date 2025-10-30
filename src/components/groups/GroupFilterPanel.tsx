'use client';

import { useState, useMemo, useEffect } from 'react';
import { Plus, X, Filter as FilterIcon } from 'lucide-react';
import { FieldSelect } from '@/components/common/FieldSelect';
import { getConditionalFilterAllowedColumns } from '@/lib/metadata-manager';
import { getFieldTypes, initializeFieldTypes } from '@/lib/field-type-store';
import type { FilterCondition, ExcelRow } from '@/types';
import type { FieldInfo } from '@/lib/field-type-store';

interface GroupFilterPanelProps {
  data: ExcelRow[];
  initialFilters?: FilterCondition[];
  onFiltersChange: (filters: FilterCondition[]) => void;
  availableFields: string[];
}

const OPERATORS: Array<{ value: FilterCondition['operator']; label: string }> = [
  { value: '=', label: 'Равно' },
  { value: '!=', label: 'Не равно' },
  { value: '>', label: 'Больше' },
  { value: '<', label: 'Меньше' },
  { value: '>=', label: 'Больше или равно' },
  { value: '<=', label: 'Меньше или равно' },
  { value: 'contains', label: 'Содержит' },
];

export function GroupFilterPanel({
  data,
  initialFilters = [],
  onFiltersChange,
  availableFields,
}: GroupFilterPanelProps) {
  const [filters, setFilters] = useState<FilterCondition[]>(initialFilters);
  const [fieldTypes, setFieldTypes] = useState<Record<string, FieldInfo>>({});
  const [initialized, setInitialized] = useState(false);

  // Инициализируем fieldTypes при монтировании или изменении availableFields
  useEffect(() => {
    if (availableFields.length === 0) {
      setInitialized(true);
      return;
    }

    const existing = getFieldTypes();
    
    // Если нет типов или их меньше чем полей - инициализируем
    if (Object.keys(existing).length === 0 || Object.keys(existing).length < availableFields.length) {
      const initialized = initializeFieldTypes(availableFields, data);
      setFieldTypes(initialized);
    } else {
      setFieldTypes(existing);
    }
    
    setInitialized(true);
  }, [availableFields, data]);

  // Получаем ВСЕ видимые поля, кроме используемых в иерархии
  const filterableFields = useMemo(
    () => getConditionalFilterAllowedColumns(availableFields),
    [availableFields]
  );

  const addFilter = (): void => {
    const newFilter: FilterCondition = {
      id: `filter_${Date.now()}_${Math.random()}`,
      column: filterableFields[0] || '',
      operator: '=' as const,
      value: '',
    };

    const updatedFilters = [...filters, newFilter];
    setFilters(updatedFilters);
    onFiltersChange(updatedFilters);
  };

  const updateFilter = (id: string, updates: Partial<FilterCondition>): void => {
    const updatedFilters = filters.map((f) =>
      f.id === id ? { ...f, ...updates } : f
    );
    setFilters(updatedFilters);
    onFiltersChange(updatedFilters);
  };

  const removeFilter = (id: string): void => {
    const updatedFilters = filters.filter((f) => f.id !== id);
    setFilters(updatedFilters);
    onFiltersChange(updatedFilters);
  };

  const clearAll = (): void => {
    setFilters([]);
    onFiltersChange([]);
  };

  const getColumnValues = (column: string): Array<string | number> => {
    const values = new Set<string | number>();
    for (const row of data) {
      const val = row[column];
      if (val !== null && val !== undefined && typeof val !== 'boolean') {
        values.add(val);
      }
    }
    return Array.from(values).slice(0, 100);
  };

  if (!initialized) {
    return (
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
        ℹ️ Инициализация типов полей...
      </div>
    );
  }

  if (filterableFields.length === 0) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700 space-y-2">
        <p className="font-medium">⚠️ Нет доступных полей для условных фильтров</p>
        <p>
          Все ваши поля либо скрыты, либо используются в иерархии. Проверьте в настройках
          (раздел "Основные"), что нужные поля отмечены как "Видимо в фильтрах и формулах".
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <FilterIcon className="w-4 h-4 text-gray-500 mr-2" />
          <span className="text-sm text-gray-600">
            {filters.length === 0 ? 'Фильтры не применены' : `Применено фильтров: ${filters.length}`}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          {filters.length > 0 && (
            <button
              onClick={clearAll}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Очистить все
            </button>
          )}
          <button
            onClick={addFilter}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
          >
            <Plus className="w-4 h-4 mr-1" />
            Добавить фильтр
          </button>
        </div>
      </div>

      {filters.length > 0 && (
        <div className="space-y-3">
          {filters.map((filter) => (
            <div key={filter.id} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              {/* Выбор колонки */}
              <div className="flex-1 min-w-0">
                <FieldSelect
                  fieldType="filter"
                  value={filter.column}
                  onChange={(col) => updateFilter(filter.id, { column: col })}
                  availableFields={availableFields}
                  fieldTypes={fieldTypes}
                  placeholder="Выберите поле"
                />
              </div>

              {/* Выбор оператора */}
              <select
                value={filter.operator}
                onChange={(e) => {
                  const value = e.target.value;
                  if (isValidOperator(value)) {
                    updateFilter(filter.id, { operator: value });
                  }
                }}
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                {OPERATORS.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>

              {/* Значение */}
              {filter.operator === 'contains' ? (
                <input
                  type="text"
                  value={String(filter.value)}
                  onChange={(e) =>
                    updateFilter(filter.id, { value: e.target.value })
                  }
                  placeholder="Введите значение..."
                  className="w-40 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              ) : (
                <select
                  value={String(filter.value)}
                  onChange={(e) => {
                    const val = e.target.value;
                    const numVal = Number(val);
                    updateFilter(filter.id, {
                      value: !isNaN(numVal) && val !== '' ? numVal : val,
                    });
                  }}
                  className="w-40 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">Выберите значение...</option>
                  {getColumnValues(filter.column).map((val, idx) => (
                    <option key={idx} value={String(val)}>
                      {String(val)}
                    </option>
                  ))}
                </select>
              )}

              {/* Удаление */}
              <button
                onClick={() => removeFilter(filter.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Подсказка */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
        💡 <strong>Доступные поля для фильтров:</strong> Все видимые поля, кроме используемых в иерархии.
        ({filterableFields.length} доступных полей)
      </div>
    </div>
  );
}

function isValidOperator(value: unknown): value is FilterCondition['operator'] {
  return typeof value === 'string' && ['=', '!=', '>', '<', '>=', '<=', 'contains'].includes(value);
}
