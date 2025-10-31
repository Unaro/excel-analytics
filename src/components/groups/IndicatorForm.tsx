'use client';

import { useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { FormulaBuilder } from './FormulaBuilder';
import { AlertBox } from '@/components/common/AlertBox';
import type { Indicator } from '@/lib/data-store';

interface IndicatorFormProps {
  onSave: (indicator: Indicator) => void;
  onCancel: () => void;
  availableFields: string[];
  existingNames?: string[];
  /**
   * Режим использования внутри GroupForm
   * - true: скрывает чекбокс "Сохранить в библиотеку" и автоматически добавляет
   * - false: показывает чекбокс для выбора (используется на странице /groups)
   */
  isInlineMode?: boolean;
  /** Callback при сохранении показателя в библиотеку (опционально) */
  onAddToLibrary?: (indicator: Indicator) => void;
}

export function IndicatorForm({
  onSave,
  onCancel,
  availableFields,
  existingNames = [],
  isInlineMode = false,
  onAddToLibrary,
}: IndicatorFormProps) {
  const [name, setName] = useState('');
  const [formula, setFormula] = useState('');
  const [saveToLibrary, setSaveToLibrary] = useState(true);
  const [errors, setErrors] = useState<{ name?: string; formula?: string }>({});

  const validate = (): boolean => {
    const newErrors: { name?: string; formula?: string } = {};

    if (!name.trim()) {
      newErrors.name = 'Введите название показателя';
    } else if (existingNames.includes(name.trim())) {
      newErrors.name = 'Показатель с таким названием уже существует';
    }

    if (!formula.trim()) {
      newErrors.formula = 'Введите формулу';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;

    const indicator: Indicator = {
      name: name.trim(),
      formula: formula.trim(),
    };

    // В режиме inline автоматически добавляем в библиотеку
    if (isInlineMode) {
      onAddToLibrary?.(indicator);
    } else if (saveToLibrary) {
      // Когда не в режиме inline, добавляем по выбору
      onAddToLibrary?.(indicator);
    }

    // В любом случае сохраняем показатель в группу/просмотр
    onSave(indicator);

    // Очищаем форму
    setName('');
    setFormula('');
    setSaveToLibrary(false);
    setErrors({});
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold">
          {isInlineMode ? 'Добавить показатель к группе' : 'Создать показатель'}
        </h3>
        <button
          onClick={onCancel}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Название */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Название показателя *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors({ ...errors, name: undefined });
            }}
            placeholder="Например: Средний доход"
            className={`w-full px-4 py-2 border ${
              errors.name ? 'border-red-300' : 'border-gray-300'
            } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
          />
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
        </div>

        {/* Формула */}
        <FormulaBuilder
          value={formula}
          onChange={(val) => {
            setFormula(val);
            if (errors.formula) setErrors({ ...errors, formula: undefined });
          }}
          availableFields={availableFields}
          error={errors.formula}
        />

        {/* Чекбокс "Сохранить в библиотеку" - только если NOT inline */}
        {!isInlineMode && (
          <>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={saveToLibrary}
                onChange={(e) => setSaveToLibrary(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">
                Сохранить в библиотеку для повторного использования
              </span>
            </label>

            {saveToLibrary && (
              <AlertBox
                type="info"
                icon={AlertCircle}
                title="Показатель будет добавлен в библиотеку"
                description="Вы сможете быстро добавлять его в другие группы"
              />
            )}
          </>
        )}

        {/* Подсказка для inline режима */}
        {isInlineMode && (
          <AlertBox
            type="info"
            icon={AlertCircle}
            title="Показатель автоматически добавляется в библиотеку"
            description="После создания его можно будет использовать в других группах"
          />
        )}

        {/* Кнопки */}
        <div className="flex space-x-3 pt-4">
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center font-medium"
          >
            <Save className="w-4 h-4 mr-2" />
            {isInlineMode ? 'Добавить показатель' : 'Создать показатель'}
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
