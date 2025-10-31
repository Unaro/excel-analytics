// src/components/groups/GroupFilterPanel.tsx (рефакторинг)
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Info } from 'lucide-react';
import { FieldSelect } from '@/components/common/FieldSelect';
import { getConditionalFilterAllowedColumns } from '@/lib/metadata-manager';
import { getFieldTypes, initializeFieldTypes } from '@/lib/field-type-store';
import type { FilterCondition, ExcelRow } from '@/types';
import type { FieldInfo } from '@/lib/field-type-store';
import { FilterToolbar, FilterRow, OperatorSelect, HintBox } from '@/components/common/filters';

interface GroupFilterPanelProps {
  data: ExcelRow[];
  initialFilters?: FilterCondition[];
  onFiltersChange: (filters: FilterCondition[]) => void;
  availableFields: string[];
}

export function GroupFilterPanel({
  data,
  initialFilters = [],
  onFiltersChange,
  availableFields,
}: GroupFilterPanelProps) {
  const [filters, setFilters] = useState<FilterCondition[]>(initialFilters);
  const [fieldTypes, setFieldTypes] = useState<Record<string, FieldInfo>>({});
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (availableFields.length === 0) {
      setInitialized(true);
      return;
    }
    const existing = getFieldTypes();
    if (Object.keys(existing).length === 0 || Object.keys(existing).length < availableFields.length) {
      const inited = initializeFieldTypes(availableFields, data);
      setFieldTypes(inited);
    } else {
      setFieldTypes(existing);
    }
    setInitialized(true);
  }, [availableFields, data]);

  const filterableFields = useMemo(
    () => getConditionalFilterAllowedColumns(availableFields),
    [availableFields]
  );

  const addFilter = (): void => {
    const newFilter: FilterCondition = {
      id: `filter_${Date.now()}_${Math.random()}`,
      column: filterableFields[0] || '',
      operator: '=',
      value: '',
    };
    const updated = [...filters, newFilter];
    setFilters(updated);
    onFiltersChange(updated);
  };

  const updateFilter = (id: string, updates: Partial<FilterCondition>): void => {
    const updated = filters.map((f) => (f.id === id ? { ...f, ...updates } : f));
    setFilters(updated);
    onFiltersChange(updated);
  };

  const removeFilter = (id: string): void => {
    const updated = filters.filter((f) => f.id !== id);
    setFilters(updated);
    onFiltersChange(updated);
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
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 flex items-center gap-2">
        <Info className="w-4 h-4" />
        Инициализация типов полей...
      </div>
    );
  }

  if (filterableFields.length === 0) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700 space-y-2">
        <p className="font-medium">⚠️ Нет доступных полей для условных фильтров</p>
        <p>
          Все ваши поля либо скрыты, либо используются в иерархии. Проверьте в настройках
          (раздел &quot;Основные&quot;), что нужные поля отмечены как &quot;Видимо в фильтрах и формулах&quot;.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FilterToolbar count={filters.length} onAdd={addFilter} onClearAll={filters.length ? clearAll : undefined} />

      {filters.length > 0 && (
        <div className="space-y-3">
          {filters.map((filter) => {
            const valueControl =
              filter.operator === 'contains' ? (
                <input
                  type="text"
                  value={String(filter.value)}
                  onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                  placeholder="Введите значение..."
                  className="w-40 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              ) : (
                <select
                  value={String(filter.value)}
                  onChange={(e) => {
                    const val = e.target.value;
                    const numVal = Number(val);
                    updateFilter(filter.id, { value: !isNaN(numVal) && val !== '' ? numVal : val });
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
              );

            return (
              <FilterRow
                key={filter.id}
                columnControl={
                  <FieldSelect
                    fieldType="filter"
                    value={filter.column}
                    onChange={(col) => updateFilter(filter.id, { column: col })}
                    availableFields={availableFields}
                    fieldTypes={fieldTypes}
                    placeholder="Выберите поле"
                  />
                }
                operatorControl={
                  <OperatorSelect
                    value={filter.operator}
                    onChange={(op) => updateFilter(filter.id, { operator: op })}
                  />
                }
                valueControl={valueControl}
                onRemove={() => removeFilter(filter.id)}
              />
            );
          })}
        </div>
      )}

      <HintBox>
        💡 <strong>Доступные поля для фильтров:</strong> Все видимые поля, кроме используемых в иерархии. ({filterableFields.length} доступных полей)
      </HintBox>
    </div>
  );
}
