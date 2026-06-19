'use client';

import { Card } from '@/shared/ui/card';
import { Select, SelectOption } from '@/shared/ui/select';
import { FunctionSquare } from 'lucide-react';
import { useAppSettingsStore } from '@/entities/app-settings';
import { AGGREGATE_FUNCTIONS, type AggregateFn } from '@/shared/lib/computation/lib/aggregate-formula';

const AGG_LABELS: Record<AggregateFn, string> = {
  SUM: 'Сумма (SUM)',
  AVG: 'Среднее (AVG)',
  MIN: 'Минимум (MIN)',
  MAX: 'Максимум (MAX)',
  COUNT: 'Количество (COUNT)',
  COUNT_DISTINCT: 'Уникальные (COUNT_DISTINCT)',
  MEDIAN: 'Медиана (MEDIAN)',
};

/**
 * Настройки поведения агрегатных формул.
 *
 * В формулах агрегат задаётся функцией: `MAX(a)/SUM(b)`. Если колонка
 * указана без агрегата, она оборачивается в дефолтный агрегат отсюда —
 * либо это запрещается строгим режимом.
 */
export function FormulaSettingsSection() {
  const defaultAggregate = useAppSettingsStore(s => s.defaultAggregate);
  const requireExplicit = useAppSettingsStore(s => s.requireExplicitAggregate);
  const setDefaultAggregate = useAppSettingsStore(s => s.setDefaultAggregate);
  const setRequireExplicit = useAppSettingsStore(s => s.setRequireExplicitAggregate);

  return (
    <Card className="p-6 border-l-4 border-l-indigo-500">
      <div className="flex items-start gap-4">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-lg">
          <FunctionSquare size={20} />
        </div>
        <div className="flex-1 space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Агрегатные формулы
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              В формуле агрегат задаётся функцией: <code>MAX(a) / SUM(b)</code>.
              Колонку без агрегата система обрабатывает по правилам ниже.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block text-slate-700 dark:text-slate-300">
                Дефолтный агрегат для колонки без функции
              </label>
              <Select
                value={defaultAggregate}
                onChange={e => setDefaultAggregate(e.target.value as AggregateFn)}
                disabled={requireExplicit}
              >
                {AGGREGATE_FUNCTIONS.map(fn => (
                  <SelectOption key={fn} value={fn}>{AGG_LABELS[fn]}</SelectOption>
                ))}
              </Select>
              <p className="text-xs text-slate-400 mt-1.5">
                Например, голая <code>a</code> станет{' '}
                <code>{defaultAggregate}(a)</code>.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block text-slate-700 dark:text-slate-300">
                Строгий режим
              </label>
              <label className="flex items-center gap-2 h-10 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireExplicit}
                  onChange={e => setRequireExplicit(e.target.checked)}
                  className="accent-indigo-600 w-4 h-4"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  Требовать явный агрегат
                </span>
              </label>
              <p className="text-xs text-slate-400 mt-1.5">
                Колонка без агрегатной функции — ошибка вместо авто-обёртки.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
