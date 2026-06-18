'use client';

import { useState } from 'react';
import { AggregateFunction, useMetricTemplateStore } from '@/entities/metric';
import { Check, X } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Select, SelectOption } from '@/shared/ui/select';
import { toast } from '@/shared/ui/toast';
import { VisualFormulaBuilder } from './VisualFormulaBuilder';
import { useFormulaValidation } from '@/entities/formula';
import type { DisplayFormat } from '@/entities/metric';

interface TemplateFormProps {
  onCancel: () => void;
  onSuccess: (newTemplateId: string) => void;
}

const FORMAT_LABELS: Record<DisplayFormat, string> = {
  number: 'Число (1 234)',
  decimal: 'Дробное (1 234,56)',
  percent: 'Процент: доля → % (0,57 → 57%)',
  percent_raw: 'Процент: готовое значение (57 → 57%)',
  currency: 'Денежное (1 234,56)',
  scientific: 'Научное (1.2e3)',
};

/** Пояснение под выбранным форматом — особенно для двух режимов процента. */
const FORMAT_HINTS: Partial<Record<DisplayFormat, string>> = {
  percent:
    'Значение — доля от 1. Формула вида a/b (0,57) → показывается 57%. ' +
    'НЕ умножайте на 100 в формуле. Пороги окрашивания задавайте в процентах (например, >50).',
  percent_raw:
    'Значение уже в процентах. Формула вида a/b*100 (57) → показывается 57%. ' +
    'Пороги окрашивания — в процентах (например, >50).',
};

export function TemplateForm({ onCancel, onSuccess }: TemplateFormProps) {
  const addTemplate = useMetricTemplateStore(s => s.addTemplate);
  const { validate, isValid, error } = useFormulaValidation();

  const [name, setName] = useState('');
  const [type, setType] = useState<'aggregate' | 'calculated'>('aggregate');
  const [aggFunc, setAggFunc] = useState<AggregateFunction>('SUM');
  const [formula, setFormula] = useState('');
  const [fieldAlias, setFieldAlias] = useState('value');
  // Формат — источник правды для всех групп и колонок дашборда
  const [displayFormat, setDisplayFormat] = useState<DisplayFormat>('number');
  const [decimalPlaces, setDecimalPlaces] = useState(2);
  const [unit, setUnit] = useState('');

  const handleSubmit = () => {
    if (!name) return;

    const base = {
      name,
      displayFormat,
      decimalPlaces,
      unit: unit.trim() || undefined,
      dependencies: [],
    };

    let newId = '';

    if (type === 'aggregate') {
      newId = addTemplate({
        ...base,
        type: 'aggregate',
        aggregateFunction: aggFunc,
        aggregateField: fieldAlias,
        dependencies: [{ type: 'field', alias: fieldAlias }]
      });
    } else {
      if (!isValid) return;
      newId = addTemplate({
        ...base,
        type: 'calculated',
        formula,
        dependencies: []
      });
    }

    toast.success('Шаблон создан');
    onSuccess(newId);
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-xs font-medium mb-1.5 text-slate-700 dark:text-slate-300">Название</label>
        <Input 
          value={name} 
          onChange={e => setName(e.target.value)}
          placeholder="Например: Сумма площадей"
          autoFocus
        />
      </div>

      <div className="flex p-1 bg-slate-100 dark:bg-slate-900 rounded-lg w-fit">
        <button
          onClick={() => setType('aggregate')}
          className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
            type === 'aggregate' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          Агрегация
        </button>
        <button
          onClick={() => setType('calculated')}
          className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
            type === 'calculated' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          Формула
        </button>
      </div>

      {type === 'aggregate' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in">
          <div>
            <label className="block text-xs font-medium mb-1.5 text-slate-700 dark:text-slate-300">Функция</label>
            <Select
              value={aggFunc}
              onChange={e => setAggFunc(e.target.value as AggregateFunction)}
            >
              <SelectOption value="SUM">Сумма (SUM)</SelectOption>
              <SelectOption value="AVG">Среднее (AVG)</SelectOption>
              <SelectOption value="COUNT">Количество (COUNT)</SelectOption>
              <SelectOption value="MAX">Максимум (MAX)</SelectOption>
              <SelectOption value="MIN">Минимум (MIN)</SelectOption>
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 text-slate-700 dark:text-slate-300">Переменная</label>
            <Input 
              value={fieldAlias} 
              onChange={(e) => setFieldAlias(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 text-slate-500"
            />
          </div>
        </div>
      ) : (
        <div className="animate-in fade-in space-y-2">
          <label className="block text-xs font-medium mb-1.5 text-slate-700 dark:text-slate-300">Конструктор формулы</label>
          
          {/* ЗАМЕНЯЕМ Input НА VisualFormulaBuilder */}
          <VisualFormulaBuilder 
            initialFormula={formula}
            onChange={(newVal: string) => {
              setFormula(newVal);
              validate(newVal);
            }}
          />

          {/* Показываем результат текстом для проверки */}
          <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-900 border rounded text-xs font-mono text-slate-500 flex justify-between items-center">
             <span>Результат: {formula || "..."}</span>
             {formula && (isValid ? <Check size={14} className="text-emerald-500" /> : <X size={14} className="text-red-500" />)}
          </div>
          
          {error && <div className="text-red-500 text-xs mt-1">{error}</div>}
        </div>
      )}

      {/* Формат отображения — наследуется всеми группами и дашбордами */}
      <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
          Формат отображения
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1.5 text-slate-700 dark:text-slate-300">Формат</label>
            <Select
              value={displayFormat}
              onChange={e => setDisplayFormat(e.target.value as DisplayFormat)}
            >
              {(Object.keys(FORMAT_LABELS) as DisplayFormat[]).map(f => (
                <SelectOption key={f} value={f}>{FORMAT_LABELS[f]}</SelectOption>
              ))}
            </Select>
            {FORMAT_HINTS[displayFormat] && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">
                {FORMAT_HINTS[displayFormat]}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 text-slate-700 dark:text-slate-300">Знаков после запятой</label>
            <Input
              type="number"
              min={0}
              max={10}
              value={decimalPlaces}
              onChange={e => {
                const n = parseInt(e.target.value, 10);
                setDecimalPlaces(isNaN(n) ? 0 : Math.min(10, Math.max(0, n)));
              }}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium mb-1.5 text-slate-700 dark:text-slate-300">
              Единица измерения <span className="text-slate-400">(необязательно)</span>
            </label>
            <Input
              value={unit}
              onChange={e => setUnit(e.target.value)}
              placeholder="чел., м², ₽…"
              maxLength={10}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="ghost" onClick={onCancel}>Отмена</Button>
        <Button 
          onClick={handleSubmit} 
          disabled={!name || (type === 'calculated' && !isValid)}
        >
          Создать
        </Button>
      </div>
    </div>
  );
}