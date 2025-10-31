// src/components/groups/IndicatorForm.tsx (рефакторинг)
'use client';

import { useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { FormulaBuilder } from './FormulaBuilder';
import { Card, AlertBox } from '@/components/common';
import { FormRow, FormActions } from '@/components/common/form';
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
    const trimmed = name.trim();
    if (!trimmed) newErrors.name = 'Введите название показателя';
    else if (existingNames.includes(trimmed)) newErrors.name = 'Показатель с таким названием уже существует';
    if (!formula.trim()) newErrors.formula = 'Введите формулу';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const indicator: Indicator = { name: name.trim(), formula: formula.trim() };

    // Правила сохранения в библиотеку:
    // - в inline-режиме всегда добавляем
    // - вне inline — согласно чекбоксу
    if (isInlineMode || saveToLibrary) onAddToLibrary?.(indicator);

    onSave(indicator);

    // Очистка формы
    setName('');
    setFormula('');
    setSaveToLibrary(false);
    setErrors({});
  };

  return (
    <Card
      title={isInlineMode ? 'Добавить показатель к группе' : 'Создать показатель'}
      rightBadge={
        <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" aria-label="Закрыть">
          <X className="w-5 h-5" />
        </button>
      }
      hoverEffect={false}
    >
      <div className="space-y-4">
        <FormRow label="Название показателя" required error={errors.name}>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors({ ...errors, name: undefined });
            }}
            placeholder="Например: Средний доход"
            className={`w-full px-4 py-2 border ${errors.name ? 'border-red-300' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
          />
        </FormRow>

        <FormRow label="Формула" required error={errors.formula}>
          <FormulaBuilder
            value={formula}
            onChange={(val) => {
              setFormula(val);
              if (errors.formula) setErrors({ ...errors, formula: undefined });
            }}
            availableFields={availableFields}
            error={errors.formula}
          />
        </FormRow>

        {!isInlineMode && (
          <>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={saveToLibrary}
                onChange={(e) => setSaveToLibrary(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Сохранить в библиотеку для повторного использования</span>
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

        {isInlineMode && (
          <AlertBox
            type="info"
            icon={AlertCircle}
            title="Показатель автоматически добавляется в библиотеку"
            description="После создания его можно будет использовать в других группах"
          />
        )}

        <FormActions
          primaryLabel={isInlineMode ? 'Добавить показатель' : 'Создать показатель'}
          onPrimary={handleSave}
          onCancel={onCancel}
          disabled={false}
        />
      </div>
    </Card>
  );
}
