'use client';

import { useState, useEffect } from 'react';
import { Save, Trash2, Plus, GripVertical, AlertCircle, CheckCircle } from 'lucide-react';
import { getFieldTypes, saveFieldTypes } from '@/lib/field-type-store';
import { dataStore } from '@/lib/data-store';
import type { FieldInfo } from '@/lib/field-type-store';

export default function SettingsHierarchyPage() {
  const [hierarchyConfig, setHierarchyConfig] = useState<string[]>([]);
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [fieldTypes, setFieldTypes] = useState<Record<string, FieldInfo>>({});
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const config = JSON.parse(localStorage.getItem('hierarchyConfig') || '[]') as string[];
    const headers = dataStore.getHeaders();
    const types = getFieldTypes();

    setHierarchyConfig(config);
    setAvailableFields(headers);
    setFieldTypes(types);
    setLoading(false);
  }, []);

  const handleSaveConfig = (): void => {
    localStorage.setItem('hierarchyConfig', JSON.stringify(hierarchyConfig));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleAddField = (field: string): void => {
    if (!hierarchyConfig.includes(field)) {
      const newConfig = [...hierarchyConfig, field];
      setHierarchyConfig(newConfig);

      // Обновляем fieldTypes чтобы отметить поле как используемое в иерархии
      const updated = {
        ...fieldTypes,
        [field]: {
          ...fieldTypes[field],
          isInHierarchy: true,
        },
      };
      setFieldTypes(updated);
      saveFieldTypes(updated);
    }
  };

  const handleRemoveField = (index: number): void => {
    const field = hierarchyConfig[index];
    const newConfig = hierarchyConfig.filter((_, i) => i !== index);
    setHierarchyConfig(newConfig);

    // Обновляем fieldTypes чтобы отметить поле как не используемое в иерархии
    const updated = {
      ...fieldTypes,
      [field]: {
        ...fieldTypes[field],
        isInHierarchy: false,
      },
    };
    setFieldTypes(updated);
    saveFieldTypes(updated);
  };

  const handleDragStart = (index: number): void => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
  };

  const handleDrop = (targetIndex: number): void => {
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      return;
    }

    const newConfig = [...hierarchyConfig];
    const [draggedItem] = newConfig.splice(draggedIndex, 1);
    newConfig.splice(targetIndex, 0, draggedItem);
    setHierarchyConfig(newConfig);
    setDraggedIndex(null);
  };

  const categoricalFields = availableFields.filter(
    (field) => fieldTypes[field]?.type === 'categorical' && fieldTypes[field]?.isVisible
  );

  const unselectedFields = categoricalFields.filter((field) => !hierarchyConfig.includes(field));

  const hierarchyLevelLabels: Record<number, string> = {
    0: 'Первый уровень',
    1: 'Второй уровень',
    2: 'Третий уровень',
    3: 'Четвёртый уровень',
    4: 'Пятый уровень',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Информация */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
        <h2 className="text-lg font-semibold text-blue-900 mb-3">🏗️ Настройка иерархии</h2>
        <p className="text-sm text-blue-800 mb-3">
          Определите иерархическую структуру для фильтрации данных. Порядок важен: от общего
          (более высокого уровня) к частному (более низкому).
        </p>
        <div className="text-xs text-blue-700 bg-white p-2 rounded border border-blue-200">
          💡 <strong>Пример:</strong> Регион → Город → Район
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Выбранная иерархия */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 flex items-center">
                <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                Выбранные уровни иерархии ({hierarchyConfig.length})
              </h3>
            </div>

            {hierarchyConfig.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-gray-500 text-sm mb-4">Иерархия не настроена</p>
                <p className="text-xs text-gray-400">Добавьте категориальные поля справа</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {hierarchyConfig.map((field, index) => (
                  <div
                    key={index}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(index)}
                    className={`
                      flex items-center gap-3 px-6 py-4 cursor-move transition-colors
                      ${draggedIndex === index ? 'bg-blue-100 opacity-50' : 'hover:bg-gray-50'}
                    `}
                  >
                    <GripVertical className="w-5 h-5 text-gray-400 flex-shrink-0" />

                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">{field}</div>
                      <div className="text-xs text-gray-500">
                        {hierarchyLevelLabels[index] || `Уровень ${index + 1}`}
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemoveField(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Кнопка сохранения */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-2">
              <button
                onClick={handleSaveConfig}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center font-medium"
              >
                <Save className="w-4 h-4 mr-2" />
                Сохранить конфигурацию
              </button>

              {saved && (
                <div className="px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium flex items-center">
                  ✓ Сохранено
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Доступные поля */}
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900 flex items-center">
              <Plus className="w-5 h-5 text-orange-600 mr-2" />
              Доступные поля ({unselectedFields.length})
            </h3>
          </div>

          {unselectedFields.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-gray-500 text-sm">Нет доступных полей</p>
              <p className="text-xs text-gray-400 mt-2">
                В настройках должны быть категориальные видимые поля
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
              {unselectedFields.map((field) => (
                <button
                  key={field}
                  onClick={() => handleAddField(field)}
                  className="w-full text-left px-6 py-3 hover:bg-blue-50 transition-colors flex items-center justify-between group"
                >
                  <span className="text-sm font-medium text-gray-900 truncate">{field}</span>
                  <Plus className="w-4 h-4 text-gray-400 group-hover:text-blue-600 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Требования */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
        <h3 className="font-semibold text-amber-900 mb-3">⚠️ Требования к полям</h3>
        <ul className="text-sm text-amber-800 space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-amber-600 flex-shrink-0">•</span>
            <span>Поле должно быть типа "Категориальное"</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-600 flex-shrink-0">•</span>
            <span>Поле должно быть отмечено как "Видимо в фильтрах и формулах"</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-600 flex-shrink-0">•</span>
            <span>Поле должно быть отмечено как "Использовать в иерархии" в основных настройках</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-600 flex-shrink-0">•</span>
            <span>Порядок в иерархии должен быть от общего к частному</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-600 flex-shrink-0">•</span>
            <span>Перетащите поля для изменения порядка</span>
          </li>
        </ul>
      </div>

      {/* Текущая конфигурация */}
      {hierarchyConfig.length > 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-6">
          <h3 className="font-semibold text-green-900 mb-3">✓ Текущая конфигурация</h3>
          <div className="text-sm text-green-800 space-y-1">
            {hierarchyConfig.map((field, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-green-200 text-green-700 flex items-center justify-center text-xs font-bold">
                  {idx + 1}
                </span>
                <span>{field}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
