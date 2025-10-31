'use client';

import { useState, useMemo, useEffect } from 'react';
import { X, Save, Layers, Filter as FilterIcon, Trash2, Plus, BookOpen, AlertCircle } from 'lucide-react';
import { GroupFilterPanel } from './GroupFilterPanel';
import HierarchyFilter from './hierarchyFilter';
import { IndicatorForm } from './IndicatorForm';
import { SimpleEmptyState } from '@/components/common/SimpleEmptyState';
import { initializeFieldTypes } from '@/lib/field-type-store';
import type { Group, Indicator } from '@/lib/data-store';
import type { FilterCondition, HierarchyFilters, ExcelRow } from '@/types';
import { Section } from '../common';

interface GroupFormProps {
  group?: Group | null;
  onSave: (groupData: Omit<Group, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  availableFields: string[];
  rawData: ExcelRow[];
  hierarchyConfig: string[];
  libraryIndicators?: Indicator[];
  onAddIndicatorToLibrary?: (indicator: Indicator) => void;
}

export function GroupForm({
  group,
  onSave,
  onCancel,
  availableFields,
  rawData,
  hierarchyConfig,
  libraryIndicators = [],
  onAddIndicatorToLibrary,
}: GroupFormProps) {
  const [name, setName] = useState(group?.name || '');
  const [description, setDescription] = useState(group?.description || '');
  const [hierarchyFilters, setHierarchyFilters] = useState<HierarchyFilters>(
    group?.hierarchyFilters || {}
  );
  const [filters, setFilters] = useState<FilterCondition[]>(group?.filters || []);
  const [indicators, setIndicators] = useState<Indicator[]>(group?.indicators || []);
  const [showIndicatorForm, setShowIndicatorForm] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [errors, setErrors] = useState<{ name?: string }>({});
  const [fieldTypesInitialized, setFieldTypesInitialized] = useState(false);

  // Инициализируем fieldTypes один раз при монтировании
  useEffect(() => {
    if (availableFields.length === 0) {
      setFieldTypesInitialized(true);
      return;
    }

    initializeFieldTypes(availableFields, rawData);
    setFieldTypesInitialized(true);
  }, []);

  const existingIndicatorNames = useMemo(() => indicators.map((i) => i.name), [indicators]);

  const availableLibraryIndicators = useMemo(() => {
    if (!libraryIndicators || libraryIndicators.length === 0) return [];
    return libraryIndicators.filter((lib) => !existingIndicatorNames.includes(lib.name));
  }, [libraryIndicators, existingIndicatorNames]);

  const validate = (): boolean => {
    const newErrors: { name?: string } = {};
    if (!name.trim()) {
      newErrors.name = 'Введите название группы';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = (): void => {
    if (!validate()) return;
    onSave({
      name: name.trim(),
      description: description.trim(),
      hierarchyFilters: Object.keys(hierarchyFilters).length > 0 ? hierarchyFilters : undefined,
      filters,
      indicators,
    });
  };

  const handleAddIndicator = (indicator: Indicator): void => {
    setIndicators([...indicators, indicator]);
    setShowIndicatorForm(false);
  };

  const handleAddFromLibrary = (indicator: Indicator): void => {
    setIndicators([...indicators, indicator]);
  };

  const handleRemoveIndicator = (name: string): void => {
    setIndicators(indicators.filter((i) => i.name !== name));
  };

  if (!fieldTypesInitialized) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">
          {group ? 'Редактировать группу' : 'Создать новую группу'}
        </h2>
        <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-6">
        {/* ===== 1. ОСНОВНАЯ ИНФОРМАЦИЯ ===== */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Название группы *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors({ ...errors, name: undefined });
              }}
              placeholder="Например: Лучшие продажи"
              className={`w-full px-4 py-2 border ${
                errors.name ? 'border-red-300' : 'border-gray-300'
              } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Описание (опционально)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Описание группы"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* ===== 2. ИЕРАРХИЧЕСКИЕ ФИЛЬТРЫ ===== */}
        {hierarchyConfig.length > 0 && (
          <Section title={`Иерархический фильтр (${Object.keys(hierarchyFilters).length > 0 ? '✓' : '○'})`} icon={FilterIcon}>
            <p className="text-sm text-gray-600 mb-4">Выберите уровень иерархии для фильтрации данных группы:</p>
            <HierarchyFilter
              data={rawData}
              config={hierarchyConfig}
              initialFilters={hierarchyFilters}
              onFilterChange={setHierarchyFilters}
            />
          </Section>
        )}

        {/* ===== 3. УСЛОВНЫЕ ФИЛЬТРЫ ===== */}
        <Section title="Условные фильтры" icon={FilterIcon}>
          <p className="text-sm text-gray-600 mb-4">Добавьте дополнительные условия фильтрации:</p>
          <GroupFilterPanel
            data={rawData}
            initialFilters={filters}
            onFiltersChange={setFilters}
            availableFields={availableFields}
          />
        </Section>

        {/* ===== 4. ПОКАЗАТЕЛИ ===== */}
        <Section title={`Показатели (${indicators.length})`} icon={Layers}>
          {/* ... текущая библиотека/форма/список ... */}
          {indicators.length === 0 && !showIndicatorForm && (
            <SimpleEmptyState icon={Layers} title="Нет показателей" description="Добавьте показатели для анализа данных группы" />
          )}
        </Section>

        {/* ===== КНОПКИ ДЕЙСТВИЙ ===== */}
        <div className="flex space-x-3 pt-6 border-t">
          <button
            onClick={handleSave}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center font-medium"
          >
            <Save className="w-5 h-5 mr-2" />
            {group ? 'Сохранить изменения' : 'Создать группу'}
          </button>
          <button
            onClick={onCancel}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
