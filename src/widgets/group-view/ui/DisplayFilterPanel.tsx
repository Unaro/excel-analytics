'use client';

import { useState } from 'react';
import { Filter, Plus, X } from 'lucide-react';
import { Select, SelectOption } from '@/shared/ui/select';
import { cn } from '@/shared/lib/utils';
import type { ConditionOperator } from '@/shared/ui/rule-card';
import type { DisplayFilterRule } from '@/shared/lib/validators';

const OPS: { value: ConditionOperator; label: string }[] = [
  { value: '>', label: '>' },
  { value: '>=', label: '≥' },
  { value: '<', label: '<' },
  { value: '<=', label: '≤' },
  { value: '==', label: '=' },
  { value: '!=', label: '≠' },
  { value: 'between', label: 'между' },
];

const rid = () => `flt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

interface DisplayFilterPanelProps {
  /** Метрики группы для выбора (id + имя). */
  metrics: { id: string; name: string }[];
  rules: DisplayFilterRule[];
  onChange: (rules: DisplayFilterRule[]) => void;
  /** Счётчик «показано из всего» — для контекста при больших уровнях. */
  shown?: number;
  total?: number;
}

/**
 * Условия отображения элементов уровня (правила по метрике, как условное
 * форматирование, но для видимости). Хранятся на группе; применяются к таблице
 * и чартам. Строка остаётся, если удовлетворяет ВСЕМ правилам (AND).
 */
export function DisplayFilterPanel({ metrics, rules, onChange, shown, total }: DisplayFilterPanelProps) {
  const [open, setOpen] = useState(false);
  const active = rules.length > 0;

  const patch = (id: string, p: Partial<DisplayFilterRule>) =>
    onChange(rules.map(r => (r.id === id ? { ...r, ...p } : r)));
  const remove = (id: string) => onChange(rules.filter(r => r.id !== id));
  const add = () => {
    const metricId = metrics[0]?.id;
    if (!metricId) return;
    onChange([...rules, { id: rid(), metricId, operator: '>', value: 0 }]);
    setOpen(true);
  };

  const metricName = (id: string) => metrics.find(m => m.id === id)?.name ?? id;
  const filtered = active && shown !== undefined && total !== undefined && shown !== total;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-sm font-medium border transition-colors',
          active
            ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700'
            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
        )}
        title="Условия отображения элементов уровня (правила по метрике)"
      >
        <Filter size={14} />
        Условия
        {active && <span className="ml-0.5 px-1.5 rounded-full bg-indigo-600 text-white text-[10px] leading-4">{rules.length}</span>}
      </button>

      {filtered && (
        <span className="ml-2 text-[11px] text-slate-400">показано {shown} из {total}</span>
      )}

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-[420px] max-w-[90vw] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Условия отображения</div>
            <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={15} /></button>
          </div>
          <p className="text-[11px] text-slate-400">
            Элемент уровня показывается, если удовлетворяет <b>всем</b> правилам. Сравнение — как видно (для %: в процентах).
          </p>

          {metrics.length === 0 ? (
            <p className="text-[11px] text-slate-400 py-2">Нет метрик для фильтра.</p>
          ) : rules.length === 0 ? (
            <p className="text-[11px] text-slate-400 py-2">Правил нет — показаны все элементы.</p>
          ) : (
            <div className="space-y-1.5">
              {rules.map(r => (
                <div key={r.id} className="flex items-center gap-1.5">
                  <Select
                    className="h-7 text-[11px] px-2 py-0 flex-1 min-w-0"
                    value={r.metricId}
                    onChange={e => patch(r.id, { metricId: e.target.value })}
                  >
                    {metrics.map(m => <SelectOption key={m.id} value={m.id}>{metricName(m.id)}</SelectOption>)}
                  </Select>
                  <Select
                    className="h-7 text-[11px] px-2 py-0 w-20 shrink-0"
                    value={r.operator}
                    onChange={e => patch(r.id, { operator: e.target.value as ConditionOperator })}
                  >
                    {OPS.map(o => <SelectOption key={o.value} value={o.value}>{o.label}</SelectOption>)}
                  </Select>
                  <input
                    type="number"
                    value={r.value}
                    onChange={e => patch(r.id, { value: Number(e.target.value) || 0 })}
                    className="h-7 w-20 shrink-0 px-2 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  {r.operator === 'between' && (
                    <input
                      type="number"
                      value={r.value2 ?? 0}
                      onChange={e => patch(r.id, { value2: Number(e.target.value) || 0 })}
                      title="Верхняя граница"
                      className="h-7 w-20 shrink-0 px-2 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  )}
                  <button type="button" onClick={() => remove(r.id)} title="Удалить" className="text-slate-300 hover:text-rose-500 shrink-0"><X size={14} /></button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <button type="button" onClick={add} disabled={metrics.length === 0}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-indigo-600 hover:text-indigo-500 disabled:opacity-40">
              <Plus size={13} /> Правило
            </button>
            {active && (
              <button type="button" onClick={() => onChange([])} className="text-[11px] text-slate-400 hover:text-rose-500">
                Сбросить все
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
