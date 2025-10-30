'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import { getConditionalFilterAllowedColumns, getFormulaAllowedColumns } from '@/lib/metadata-manager';
import { groupFieldsByType } from '@/lib/field-type-store';
import type { FieldInfo } from '@/lib/field-type-store';

interface FieldSelectProps {
  /** Тип поля для выбора */
  fieldType: 'formula' | 'filter';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  availableFields: string[];
  fieldTypes: Record<string, FieldInfo>;
  disabled?: boolean;
}

const typeIcons: Record<string, string> = {
  numeric: '🔢',
  categorical: '🏷️',
  text: '📝',
  date: '📅',
};

const typeLabels: Record<string, string> = {
  numeric: 'Числовые',
  categorical: 'Категориальные',
  text: 'Текстовые',
  date: 'Даты',
};

export function FieldSelect({
  fieldType,
  value,
  onChange,
  placeholder = 'Выберите поле...',
  availableFields,
  fieldTypes,
  disabled = false,
}: FieldSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Получаем доступные поля на основе типа
  const allowedFields = useMemo(() => {
    if (fieldType === 'formula') {
      return getFormulaAllowedColumns(availableFields);
    } else {
      // Для фильтров: ВСЕ видимые поля, кроме иерархии
      return getConditionalFilterAllowedColumns(availableFields);
    }
  }, [fieldType, availableFields]);

  // Группируем по типам
  const groupedFields = useMemo(() => {
    return groupFieldsByType(allowedFields, fieldTypes);
  }, [allowedFields, fieldTypes]);

  // Фильтруем по поиску
  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groupedFields;

    const filtered: Record<string, string[]> = {};
    for (const [type, fields] of Object.entries(groupedFields)) {
      const filtered_fields = fields.filter((f) =>
        f.toLowerCase().includes(search.toLowerCase())
      );
      if (filtered_fields.length > 0) {
        filtered[type] = filtered_fields;
      }
    }
    return filtered;
  }, [groupedFields, search]);

  const selectedLabel = useMemo(() => {
    return allowedFields.find((f) => f === value) || '';
  }, [value, allowedFields]);

  const hasGroups = Object.values(filteredGroups).some((fields) => fields.length > 0);

  return (
    <div className="relative w-full">
      <button
        onClick={() => setOpen(!open)}
        disabled={disabled || allowedFields.length === 0}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-left flex items-center justify-between hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        <span className="truncate text-sm">
          {selectedLabel || <span className="text-gray-500">{placeholder}</span>}
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-300 rounded-lg shadow-lg">
          {/* Поиск */}
          <div className="p-3 border-b border-gray-200 sticky top-0 bg-white">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                autoFocus
                type="text"
                placeholder="Поиск..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Список */}
          <div className="max-h-64 overflow-y-auto">
            {hasGroups ? (
              Object.entries(filteredGroups).map(([type, fields]) => (
                <div key={type}>
                  <div className="px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-600 sticky top-0">
                    {typeIcons[type]} {typeLabels[type]}
                  </div>
                  {fields.map((field) => (
                    <button
                      key={field}
                      onClick={() => {
                        onChange(field);
                        setOpen(false);
                        setSearch('');
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors flex items-center justify-between"
                    >
                      <span>{field}</span>
                      {value === field && (
                        <Check className="w-4 h-4 text-blue-600" />
                      )}
                    </button>
                  ))}
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-sm text-gray-500">
                Нет доступных полей
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
