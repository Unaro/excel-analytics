'use client';

import { useState } from 'react';
import { useMetricTemplateStore } from '@/entities/metric';
import { Check, X } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Select, SelectOption } from '@/shared/ui/select';
import { toast } from '@/shared/ui/toast';
import { VisualFormulaBuilder } from './VisualFormulaBuilder';
import { useFormulaValidation } from '@/entities/formula';
import type { DisplayFormat } from '@/entities/metric';
import type { NormalizeBase } from '@/shared/lib/utils/normalize';

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

/** Курируемые кросс-столбцовые трансформации (доля от ориентира). */
const NORMALIZE_OPTIONS: { value: '' | NormalizeBase; label: string }[] = [
  { value: '', label: 'Как есть (абсолютные значения)' },
  { value: 'total', label: '% от итога столбца' },
  { value: 'max', label: '% от максимума' },
  { value: 'mean', label: '% от среднего' },
  { value: 'min', label: '% от минимума' },
];

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
  const [formula, setFormula] = useState('');
  // Формат — источник правды для всех групп и колонок дашборда
  const [displayFormat, setDisplayFormat] = useState<DisplayFormat>('number');
  const [decimalPlaces, setDecimalPlaces] = useState(2);
  const [unit, setUnit] = useState('');
  // Кросс-столбцовая нормализация (пост-обработка): % от итога/макс/…
  // Нормализованные строки показываются процентом независимо от формата ниже
  // (формат остаётся для абсолютных значений — «Итого», KPI-карточки).
  const [normalizeBy, setNormalizeBy] = useState<'' | NormalizeBase>('');

  const handleSubmit = () => {
    if (!name || !formula || !isValid) return;

    const newId = addTemplate({
      name,
      formula,
      displayFormat,
      decimalPlaces,
      unit: unit.trim() || undefined,
      dependencies: [],
      normalizeBy: normalizeBy || undefined,
    });

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

      <div className="animate-in fade-in space-y-2">
        <label className="block text-xs font-medium mb-1.5 text-slate-700 dark:text-slate-300">
          Конструктор формулы
        </label>
        <p className="text-[11px] text-slate-400 -mt-1">
          Простая метрика — один агрегат: <code>SUM(площадь)</code>. Расчётная —
          комбинация: <code>SUM(доход) / COUNT(сделки)</code>.
        </p>

        <VisualFormulaBuilder
          initialFormula={formula}
          onChange={(newVal: string) => {
            setFormula(newVal);
            validate(newVal);
          }}
        />

        <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-900 border rounded text-xs font-mono text-slate-500 flex justify-between items-center">
           <span>Результат: {formula || '...'}</span>
           {formula && (isValid ? <Check size={14} className="text-emerald-500" /> : <X size={14} className="text-red-500" />)}
        </div>

        {error && <div className="text-red-500 text-xs mt-1">{error}</div>}
      </div>

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
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium mb-1.5 text-slate-700 dark:text-slate-300">
              Показывать как <span className="text-slate-400">(пост-обработка по столбцу)</span>
            </label>
            <Select
              value={normalizeBy}
              onChange={e => setNormalizeBy(e.target.value as '' | NormalizeBase)}
            >
              {NORMALIZE_OPTIONS.map(o => (
                <SelectOption key={o.value} value={o.value}>{o.label}</SelectOption>
              ))}
            </Select>
            {normalizeBy && (
              <p className="text-xs text-slate-400 mt-1.5">
                Каждая строка делится на ориентир по столбцу текущего вида
                (в группе — дети уровня, на дашборде — строки-группы) и показывается
                процентом. Строка «Итого» и KPI-карточки остаются абсолютными
                (в выбранном выше формате).
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="ghost" onClick={onCancel}>Отмена</Button>
        <Button 
          onClick={handleSubmit} 
          disabled={!name || !formula || !isValid}
        >
          Создать
        </Button>
      </div>
    </div>
  );
}