'use client';

import { cn } from '@/shared/lib/utils';
import { Select, SelectOption } from '@/shared/ui/select';
import { extractVariables } from '@/shared/lib/utils/formula';

/** Редактируемые поля шаблона показателя (формула + формат). */
export interface TemplateFormatValue {
  formula: string;
  displayFormat: string;
  decimalPlaces: number;
  unit: string;
  normalizeBy: '' | 'total' | 'max' | 'min' | 'mean';
}

export const DEFAULT_TEMPLATE_FORMAT: TemplateFormatValue = {
  formula: 'SUM(value)',
  displayFormat: 'number',
  decimalPlaces: 2,
  unit: '',
  normalizeBy: '',
};

/** Быстрый выбор агрегации — пишет `FN(value)`. */
const AGG_FUNCS = ['SUM', 'AVG', 'MIN', 'MAX', 'COUNT', 'MEDIAN'] as const;

export const FORMAT_OPTIONS: { value: string; label: string }[] = [
  { value: 'number', label: 'Число (1 234)' },
  { value: 'decimal', label: 'Дробное (1 234,56)' },
  { value: 'percent', label: 'Процент: доля → % (0,57 → 57%)' },
  { value: 'percent_raw', label: 'Процент: готовое (57 → 57%)' },
  { value: 'currency', label: 'Денежное (1 234,56)' },
  { value: 'scientific', label: 'Научное (1.2e3)' },
];

export const NORMALIZE_OPTIONS: { value: TemplateFormatValue['normalizeBy']; label: string }[] = [
  { value: '', label: 'Как есть' },
  { value: 'total', label: '% от итога' },
  { value: 'max', label: '% от максимума' },
  { value: 'mean', label: '% от среднего' },
  { value: 'min', label: '% от минимума' },
];

/**
 * Компактный редактор формулы и формата одновходового шаблона (один алиас поля).
 * Переиспользуется панелями импорта (сырые группы; в будущем — единая панель).
 */
export function TemplateFormatFields({
  value,
  onChange,
}: {
  value: TemplateFormatValue;
  onChange: (patch: Partial<TemplateFormatValue>) => void;
}) {
  const vars = extractVariables(value.formula);
  const validSingle = vars.length === 1;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {AGG_FUNCS.map(fn => {
          const active = value.formula.trim() === `${fn}(value)`;
          return (
            <button
              key={fn}
              type="button"
              onClick={() => onChange({ formula: `${fn}(value)` })}
              className={cn(
                'px-2 py-0.5 rounded text-[11px] font-medium border transition-colors',
                active
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
              )}
            >
              {fn}
            </button>
          );
        })}
      </div>
      <input
        value={value.formula}
        onChange={e => onChange({ formula: e.target.value })}
        spellCheck={false}
        className={cn(
          'w-full h-7 px-2 text-[12px] font-mono rounded border bg-white dark:bg-slate-950 outline-none focus:ring-1',
          validSingle
            ? 'border-slate-200 dark:border-slate-700 focus:ring-indigo-500'
            : 'border-amber-300 dark:border-amber-800 focus:ring-amber-500'
        )}
      />
      {!validSingle && (
        <p className="text-[10px] text-amber-500">
          Одно поле в формуле (напр. <code>SUM(value)</code>); иначе при импорте — <code>SUM(value)</code>.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Select
          className="h-7 text-[11px] px-2 py-0"
          value={value.displayFormat}
          onChange={e => onChange({ displayFormat: e.target.value })}
        >
          {FORMAT_OPTIONS.map(o => (
            <SelectOption key={o.value} value={o.value}>{o.label}</SelectOption>
          ))}
        </Select>
        <div className="flex gap-2">
          <input
            type="number"
            min={0}
            max={10}
            value={value.decimalPlaces}
            title="Знаков после запятой"
            onChange={e => {
              const n = parseInt(e.target.value, 10);
              onChange({ decimalPlaces: isNaN(n) ? 0 : Math.min(10, Math.max(0, n)) });
            }}
            className="h-7 w-14 px-2 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <input
            value={value.unit}
            onChange={e => onChange({ unit: e.target.value })}
            placeholder="ед."
            maxLength={10}
            className="h-7 flex-1 min-w-0 px-2 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>
      <label className="block text-[10px] font-medium text-slate-500">
        Показывать как
        <Select
          className="h-7 text-[11px] px-2 py-0 mt-0.5"
          value={value.normalizeBy}
          onChange={e => onChange({ normalizeBy: e.target.value as TemplateFormatValue['normalizeBy'] })}
        >
          {NORMALIZE_OPTIONS.map(o => (
            <SelectOption key={o.value} value={o.value}>{o.label}</SelectOption>
          ))}
        </Select>
      </label>
    </div>
  );
}
