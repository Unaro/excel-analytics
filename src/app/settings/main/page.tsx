'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { dataStore } from '@/lib/data-store';
import { getFieldTypes, saveFieldTypes, initializeFieldTypes } from '@/lib/field-type-store';
import type { FieldInfo, FieldType } from '@/lib/field-type-store';
import type { ExcelRow } from '@/types';

export default function SettingsMainPage() {
  const [fieldTypes, setFieldTypes] = useState<Record<string, FieldInfo>>({});
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<ExcelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const headers = dataStore.getHeaders();
    const data = dataStore.getRawData();

    setHeaders(headers);
    setData(data);

    const initialized = initializeFieldTypes(headers, data);
    setFieldTypes(initialized);
    setLoading(false);
  }, []);

  const handleFieldTypeChange = (fieldName: string, updates: Partial<FieldInfo>): void => {
    const updated: Record<string, FieldInfo> = {
      ...fieldTypes,
      [fieldName]: {
        ...fieldTypes[fieldName],
        ...updates,
      },
    };
    setFieldTypes(updated);
    saveFieldTypes(updated);
  };

  const toggleRowExpanded = (fieldName: string): void => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(fieldName)) {
        newSet.delete(fieldName);
      } else {
        newSet.add(fieldName);
      }
      return newSet;
    });
  };

  const getTypeColor = (type: FieldType): string => {
    const colors: Record<FieldType, string> = {
      numeric: 'bg-blue-100 text-blue-800',
      categorical: 'bg-purple-100 text-purple-800',
      text: 'bg-gray-100 text-gray-800',
      date: 'bg-green-100 text-green-800',
    };
    return colors[type];
  };

  const getTypeLabel = (type: FieldType): string => {
    const labels: Record<FieldType, string> = {
      numeric: '🔢 Числовое',
      categorical: '🏷️ Категориальное',
      text: '📝 Текстовое',
      date: '📅 Дата',
    };
    return labels[type];
  };

  const isValidFieldType = (value: unknown): value is FieldType => {
    return typeof value === 'string' && ['numeric', 'categorical', 'text', 'date'].includes(value);
  };

  const handleTypeSelectChange = (fieldName: string, e: React.ChangeEvent<HTMLSelectElement>): void => {
    const value = e.target.value;
    if (isValidFieldType(value)) {
      handleFieldTypeChange(fieldName, { type: value });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (headers.length === 0) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-center">
        <AlertCircle className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-yellow-900 mb-2">Нет загруженных данных</h3>
        <p className="text-sm text-yellow-700">
          Загрузите Excel файл на главной странице, чтобы настроить типы колонок.
        </p>
      </div>
    );
  }

  const typeStats = {
    numeric: headers.filter((h) => fieldTypes[h]?.type === 'numeric').length,
    categorical: headers.filter((h) => fieldTypes[h]?.type === 'categorical').length,
    text: headers.filter((h) => fieldTypes[h]?.type === 'text').length,
    date: headers.filter((h) => fieldTypes[h]?.type === 'date').length,
  };

  interface StatItem {
    label: string;
    value: number;
    icon: string;
    color: 'blue' | 'purple' | 'gray' | 'green';
  }

  const statItems: StatItem[] = [
    { label: 'Числовые', value: typeStats.numeric, icon: '🔢', color: 'blue' },
    { label: 'Категориальные', value: typeStats.categorical, icon: '🏷️', color: 'purple' },
    { label: 'Текстовые', value: typeStats.text, icon: '📝', color: 'gray' },
    { label: 'Даты', value: typeStats.date, icon: '📅', color: 'green' },
  ];

  return (
    <div className="space-y-8">
      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {statItems.map((stat) => (
          <div
            key={stat.label}
            className={`rounded-lg border border-${stat.color}-200 bg-${stat.color}-50 p-4`}
          >
            <div className="text-2xl mb-2">{stat.icon}</div>
            <p className="text-sm text-gray-600">{stat.label}</p>
            <p className={`text-3xl font-bold text-${stat.color}-600`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Информация о типах */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
        <h3 className="font-semibold text-blue-900 mb-4">📌 Описание типов данных</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              type: 'numeric' as const,
              label: 'Числовые',
              desc: 'Значения для математических операций (например: возраст, сумма, количество)',
            },
            {
              type: 'categorical' as const,
              label: 'Категориальные',
              desc: 'Числа как метки (например: номер района, код региона, индекс)',
            },
            {
              type: 'text' as const,
              label: 'Текстовые',
              desc: 'Текстовые данные (например: название, адрес, описание)',
            },
            {
              type: 'date' as const,
              label: 'Даты',
              desc: 'Временные данные (например: дата рождения, срок действия)',
            },
          ].map((item) => (
            <div key={item.type} className="text-sm">
              <p className="font-medium text-blue-900">{item.label}</p>
              <p className="text-blue-700">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Таблица полей */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="font-semibold text-gray-900">Управление полями ({headers.length})</h3>
        </div>

        <div className="divide-y divide-gray-200">
          {headers.map((header) => {
            const fieldInfo = fieldTypes[header];
            if (!fieldInfo) return null;

            const isExpanded = expandedRows.has(header);

            return (
              <div key={header} className="transition-colors hover:bg-gray-50">
                {/* Основная строка */}
                <div
                  onClick={() => toggleRowExpanded(header)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between cursor-pointer"
                >
                  <div className="flex-1 flex items-center gap-4 min-w-0">
                    {/* Название */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{header}</p>
                    </div>

                    {/* Тип */}
                    <span className={`px-3 py-1 rounded-full text-sm font-medium flex-shrink-0 ${getTypeColor(fieldInfo.type)}`}>
                      {getTypeLabel(fieldInfo.type)}
                    </span>

                    {/* Статусы */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {fieldInfo.isInHierarchy && (
                        <div
                          title="Используется в иерархии"
                          className="inline-flex items-center justify-center w-6 h-6 rounded bg-green-100"
                        >
                          <Check className="w-4 h-4 text-green-600" />
                        </div>
                      )}
                      {fieldInfo.allowInFormulas && (
                        <div
                          title="Доступно в формулах"
                          className="inline-flex items-center justify-center w-6 h-6 rounded bg-blue-100"
                        >
                          <span className="text-xs font-bold text-blue-600">ƒ</span>
                        </div>
                      )}
                      {!fieldInfo.isVisible && (
                        <div
                          title="Скрыто"
                          className="inline-flex items-center justify-center w-6 h-6 rounded bg-gray-100"
                        >
                          <X className="w-4 h-4 text-gray-600" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Иконка раскрытия */}
                  <div className="ml-2 flex-shrink-0 text-gray-400">
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                  </div>
                </div>

                {/* Развернутое содержимое */}
                {isExpanded && (
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 space-y-4">
                    {/* Тип данных */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Тип данных
                      </label>
                      <select
                        value={fieldInfo.type}
                        onChange={(e) => handleTypeSelectChange(header, e)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="numeric">Числовое</option>
                        <option value="categorical">Категориальное</option>
                        <option value="text">Текстовое</option>
                        <option value="date">Дата</option>
                      </select>
                    </div>

                    {/* Чекбоксы */}
                    <div className="space-y-2">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={fieldInfo.isVisible}
                          onChange={(e) =>
                            handleFieldTypeChange(header, { isVisible: e.target.checked })
                          }
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">Видимо в фильтрах и формулах</span>
                      </label>

                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={fieldInfo.allowInFormulas}
                          onChange={(e) =>
                            handleFieldTypeChange(header, {
                              allowInFormulas: e.target.checked,
                            })
                          }
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">Доступно в формулах</span>
                      </label>

                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={fieldInfo.isInHierarchy}
                          onChange={(e) =>
                            handleFieldTypeChange(header, {
                              isInHierarchy: e.target.checked,
                            })
                          }
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">Использовать в иерархии</span>
                      </label>
                    </div>

                    {/* Описание */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Описание (опционально)
                      </label>
                      <input
                        type="text"
                        value={fieldInfo.description || ''}
                        onChange={(e) =>
                          handleFieldTypeChange(header, { description: e.target.value })
                        }
                        placeholder="Добавить описание..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Подсказка */}
      <div className="rounded-lg border border-green-200 bg-green-50 p-6">
        <h3 className="font-semibold text-green-900 mb-2">✅ Совет</h3>
        <p className="text-sm text-green-800">
          Правильная классификация полей критична для работы фильтров и формул. Числовые поля
          доступны в формулах, категориальные используются в фильтрах и иерархии.
        </p>
      </div>
    </div>
  );
}
