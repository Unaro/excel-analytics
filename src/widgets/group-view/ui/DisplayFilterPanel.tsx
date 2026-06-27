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

/**
 * Числовое поле, допускающее ручной ввод «−», пустого и промежуточных значений
 * (`-`, `12.`, запятая как разделитель). Нативный `type=number` это глотает,
 * поэтому держим сырой текст в локальном состоянии и коммитим валидное число.
 */
function NumField({
  value,
  onCommit,
  title,
  className,
}: {
  value: number;
  onCommit: (n: number) => void;
  title?: string;
  className?: string;
}) {
  // Сырой текст + значение, из которого он выведен. Когда внешнее `value`
  // меняется (другое правило/сброс) и не совпадает с уже набранным — подхватываем
  // его прямо в рендере (паттерн «adjusting state during render», без эффекта).
  const [state, setState] = useState({ raw: String(value), from: value });
  if (state.from !== value && Number(state.raw.replace(',', '.')) !== value) {
    setState({ raw: String(value), from: value });
  }
  const raw = state.raw;
  const setRaw = (t: string) => setState({ raw: t, from: value });

  return (
    <input
      type="text"
      inputMode="decimal"
      value={raw}
      title={title}
      onChange={(e) => {
        const t = e.target.value;
        if (t === '' || /^-?\d*[.,]?\d*$/.test(t)) {
          setRaw(t);
          const n = Number(t.replace(',', '.'));
          if (t !== '' && t !== '-' && Number.isFinite(n)) onCommit(n);
        }
      }}
      onBlur={() => {
        const n = Number(raw.replace(',', '.'));
        if (raw === '' || raw === '-' || !Number.isFinite(n)) setRaw(String(value));
        else { onCommit(n); setRaw(String(n)); }
      }}
      className={className}
    />
  );
}

interface DisplayFilterPanelProps {
  /** Метрики группы для выбора (id + имя). */
  metrics: { id: string; name: string }[];
  rules: DisplayFilterRule[];
  onChange: (rules: DisplayFilterRule[]) => void;
  /** Счётчик «показано из всего» — для контекста при больших уровнях. */
  shown?: number;
  total?: number;
  /** Имя текущего уровня — правила действуют только на нём (не на дрилле вглубь). */
  levelLabel?: string;
}

/**
 * Условия отображения элементов уровня (правила по метрике, как условное
 * форматирование, но для видимости). Хранятся на группе; применяются к таблице
 * и чартам. Строка остаётся, если удовлетворяет ВСЕМ правилам (AND).
 */
export function DisplayFilterPanel({ metrics, rules, onChange, shown, total, levelLabel }: DisplayFilterPanelProps) {
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
            Элемент уровня показывается, если удовлетворяет <b>всем</b> правилам. Сравнение — как видно
            (для %: в процентах). Справа можно выбрать <b>число</b> или <b>другую метрику</b> строки
            (напр. «Итоговое ≠ Потребность»).
          </p>
          {levelLabel && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              Действует только на текущем уровне (<b>{levelLabel}</b>) — при переходе вглубь не
              применяется.
            </p>
          )}

          {metrics.length === 0 ? (
            <p className="text-[11px] text-slate-400 py-2">Нет метрик для фильтра.</p>
          ) : rules.length === 0 ? (
            <p className="text-[11px] text-slate-400 py-2">Правил нет — показаны все элементы.</p>
          ) : (
            <div className="space-y-1.5">
              {rules.map(r => {
                const ops = r.compareMetricId ? OPS.filter(o => o.value !== 'between') : OPS;
                const numCls = 'h-7 w-20 shrink-0 px-2 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 outline-none focus:ring-1 focus:ring-indigo-500';
                return (
                <div key={r.id} className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-1.5 last:border-0">
                  <Select
                    className="h-7 text-[11px] px-2 py-0 flex-1 min-w-[110px]"
                    value={r.metricId}
                    onChange={e => patch(r.id, { metricId: e.target.value })}
                  >
                    {metrics.map(m => <SelectOption key={m.id} value={m.id}>{metricName(m.id)}</SelectOption>)}
                  </Select>
                  <Select
                    className="h-7 text-[11px] px-2 py-0 w-16 shrink-0"
                    value={r.operator}
                    onChange={e => patch(r.id, { operator: e.target.value as ConditionOperator })}
                  >
                    {ops.map(o => <SelectOption key={o.value} value={o.value}>{o.label}</SelectOption>)}
                  </Select>
                  <Select
                    className="h-7 text-[11px] px-2 py-0 flex-1 min-w-[110px]"
                    value={r.compareMetricId ?? ''}
                    title="Сравнить с числом или с другой метрикой строки"
                    onChange={e => {
                      const v = e.target.value;
                      if (!v) patch(r.id, { compareMetricId: undefined });
                      else patch(r.id, { compareMetricId: v, operator: r.operator === 'between' ? '!=' : r.operator });
                    }}
                  >
                    <SelectOption value="">число…</SelectOption>
                    {metrics.filter(m => m.id !== r.metricId).map(m => <SelectOption key={m.id} value={m.id}>{metricName(m.id)}</SelectOption>)}
                  </Select>
                  {!r.compareMetricId && (
                    <NumField value={r.value} onCommit={v => patch(r.id, { value: v })} className={numCls} />
                  )}
                  {!r.compareMetricId && r.operator === 'between' && (
                    <NumField value={r.value2 ?? 0} onCommit={v => patch(r.id, { value2: v })} title="Верхняя граница" className={numCls} />
                  )}
                  <button type="button" onClick={() => remove(r.id)} title="Удалить" className="text-slate-300 hover:text-rose-500 shrink-0"><X size={14} /></button>
                </div>
                );
              })}
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
