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
          <div className="border-t pt-6">
            <div className="flex items-center mb-4">
              <FilterIcon className="w-5 h-5 text-purple-500 mr-2" />
              <h3 className="text-lg font-semibold">
                Иерархический фильтр ({Object.keys(hierarchyFilters).length > 0 ? '✓' : '○'})
              </h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Выберите уровень иерархии для фильтрации данных группы:
            </p>
            <HierarchyFilter
              data={rawData}
              config={hierarchyConfig}
              initialFilters={hierarchyFilters}
              onFilterChange={setHierarchyFilters}
            />
          </div>
        )}

        {/* ===== 3. УСЛОВНЫЕ ФИЛЬТРЫ ===== */}
        <div className="border-t pt-6">
          <div className="flex items-center mb-4">
            <FilterIcon className="w-5 h-5 text-orange-500 mr-2" />
            <h3 className="text-lg font-semibold">Условные фильтры</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Добавьте дополнительные условия фильтрации:
          </p>
          <GroupFilterPanel
            data={rawData}
            initialFilters={filters}
            onFiltersChange={setFilters}
            availableFields={availableFields}
          />
        </div>

        {/* ===== 4. ПОКАЗАТЕЛИ ===== */}
        <div className="border-t pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Layers className="w-5 h-5 text-blue-500 mr-2" />
              <h3 className="text-lg font-semibold">Показатели ({indicators.length})</h3>
            </div>
            <div className="flex gap-2">
              {availableLibraryIndicators.length > 0 && !showIndicatorForm && (
                <button
                  onClick={() => {
                    setShowLibrary(!showLibrary);
                    if (!showLibrary) setShowIndicatorForm(false);
                  }}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center"
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  Из библиотеки ({availableLibraryIndicators.length})
                </button>
              )}
              {!showIndicatorForm && (
                <button
                  onClick={() => {
                    setShowIndicatorForm(true);
                    setShowLibrary(false);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Создать новый
                </button>
              )}
            </div>
          </div>

          {/* Библиотека */}
          {showLibrary && availableLibraryIndicators.length > 0 && (
            <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <h4 className="font-medium text-purple-900 mb-3">Выберите из библиотеки:</h4>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {availableLibraryIndicators.map((indicator) => (
                  <div
                    key={indicator.name}
                    className="p-3 bg-white border border-purple-200 rounded-lg hover:border-purple-400 transition-colors flex items-start justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <h5 className="font-medium text-gray-900 mb-1">{indicator.name}</h5>
                      <code className="text-xs bg-gray-50 px-2 py-1 rounded text-gray-700 block break-all">
                        {indicator.formula}
                      </code>
                    </div>
                    <button
                      onClick={() => handleAddFromLibrary(indicator)}
                      className="ml-3 px-3 py-1.5 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors flex-shrink-0"
                    >
                      Добавить
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setShowLibrary(false)}
                className="mt-3 text-sm text-purple-600 hover:text-purple-700"
              >
                Скрыть библиотеку
              </button>
            </div>
          )}

          {/* Форма создания */}
          {showIndicatorForm && (
            <div className="mb-4">
              <IndicatorForm
                onSave={handleAddIndicator}
                onCancel={() => setShowIndicatorForm(false)}
                availableFields={availableFields}
                existingNames={existingIndicatorNames}
                isInlineMode={false}
                onAddToLibrary={onAddIndicatorToLibrary}
              />
            </div>
          )}

          {/* Список показателей */}
          {indicators.length > 0 ? (
            <div className="space-y-2">
              {indicators.map((indicator) => (
                <div
                  key={indicator.name}
                  className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors flex items-start justify-between"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 mb-1">{indicator.name}</h4>
                    <code className="text-sm bg-gray-50 px-2 py-1 rounded text-gray-700 block break-all">
                      {indicator.formula}
                    </code>
                  </div>
                  <button
                    onClick={() => handleRemoveIndicator(indicator.name)}
                    className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : !showIndicatorForm ? (
            <SimpleEmptyState
              icon={Layers}
              title="Нет показателей"
              description="Добавьте показатели для анализа данных группы"
            />
          ) : null}
        </div>

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
