'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, X, Search, Layers, Calculator } from 'lucide-react';
import { Input } from '@/shared/ui/input';
import { Select, SelectOption } from '@/shared/ui/select';
import { cn } from '@/shared/lib/utils';
import { extractVariables } from '@/shared/lib/utils/formula';
import type {
  AggregateTemplateSpec,
  CalculatedTemplateSpec,
  RawGroupsConfig,
} from '@/shared/lib/types/aggregate';
import {
  TemplateFormatFields,
  DEFAULT_TEMPLATE_FORMAT,
  FORMAT_OPTIONS,
  NORMALIZE_OPTIONS,
  type TemplateFormatValue,
} from './TemplateFormatFields';

/** Числовая колонка превью — кандидат в метрику. */
export interface RawGroupColumn {
  columnName: string;
  displayName: string;
}

interface RawGroupsPanelProps {
  columns: RawGroupColumn[];
  onChange: (config: RawGroupsConfig | null) => void;
}

/** Переиспользуемый показатель-шаблон (реестр). */
interface RegTemplate {
  id: string;
  name: string;
  fmt: TemplateFormatValue;
  serviceOnly: boolean;
}
/** Колонка в группе + к какому показателю-шаблону привязана (id; '' = по имени колонки). */
interface GroupItem {
  columnName: string;
  templateId: string;
}
interface DraftGroup {
  id: string;
  name: string;
  items: GroupItem[];
}
/** Расчётный показатель: формула над именами показателей. */
interface CalcDraft {
  id: string;
  name: string;
  formula: string;
  /** alias → имя показателя. */
  operands: Record<string, string>;
  displayFormat: string;
  decimalPlaces: number;
  unit: string;
  normalizeBy: '' | 'total' | 'max' | 'min' | 'mean';
}

const rid = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

/**
 * Создание групп для СЫРЫХ данных по модели агрегата (ДО импорта):
 *  1) реестр переиспользуемых показателей-шаблонов (формула/формат/служебный);
 *  2) группы — распределение колонок, у каждой колонки выбор показателя;
 *  3) расчётные показатели (формула над показателями, раскрытие по группам).
 * Эмитит RawGroupsConfig; применяется в syncFromFile общим createAggregateGroups.
 */
export function RawGroupsPanel({ columns, onChange }: RawGroupsPanelProps) {
  const displayByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of columns) m.set(c.columnName, c.displayName || c.columnName);
    return m;
  }, [columns]);

  const [templates, setTemplates] = useState<RegTemplate[]>([]);
  const [newTplName, setNewTplName] = useState('');
  const [groups, setGroups] = useState<DraftGroup[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [searchByGroup, setSearchByGroup] = useState<Record<string, string>>({});
  const [calcs, setCalcs] = useState<CalcDraft[]>([]);
  const [newCalcName, setNewCalcName] = useState('');

  const regById = useMemo(() => new Map(templates.map(t => [t.id, t])), [templates]);
  const indicatorNames = useMemo(
    () => Array.from(new Set(templates.map(t => t.name.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ru')),
    [templates]
  );

  const assigned = useMemo(() => {
    const s = new Set<string>();
    for (const g of groups) for (const it of g.items) s.add(it.columnName);
    return s;
  }, [groups]);
  const unassigned = useMemo(() => columns.filter(c => !assigned.has(c.columnName)), [columns, assigned]);

  // ── Реестр показателей ──────────────────────────────────────
  const addTemplate = () => {
    const name = newTplName.trim();
    if (!name) return;
    setTemplates(prev => [...prev, { id: rid('tpl'), name, fmt: { ...DEFAULT_TEMPLATE_FORMAT }, serviceOnly: false }]);
    setNewTplName('');
  };
  const patchTemplate = (id: string, patch: Partial<RegTemplate>) =>
    setTemplates(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)));
  const patchTemplateFmt = (id: string, patch: Partial<TemplateFormatValue>) =>
    setTemplates(prev => prev.map(t => (t.id === id ? { ...t, fmt: { ...t.fmt, ...patch } } : t)));
  const removeTemplate = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
    // Отвязать колонки от удалённого показателя.
    setGroups(prev => prev.map(g => ({ ...g, items: g.items.map(it => (it.templateId === id ? { ...it, templateId: '' } : it)) })));
  };

  // ── Группы ──────────────────────────────────────────────────
  const addGroup = () => {
    const name = newGroupName.trim();
    if (!name) return;
    setGroups(prev => [...prev, { id: rid('g'), name, items: [] }]);
    setNewGroupName('');
  };
  const patchGroup = (id: string, patch: Partial<DraftGroup>) =>
    setGroups(prev => prev.map(g => (g.id === id ? { ...g, ...patch } : g)));
  const removeGroup = (id: string) => setGroups(prev => prev.filter(g => g.id !== id));
  const assignCols = (gid: string, cols: string[]) =>
    setGroups(prev =>
      prev.map(g => {
        if (g.id !== gid) return g;
        const have = new Set(g.items.map(i => i.columnName));
        const add = cols.filter(c => !have.has(c)).map(columnName => ({ columnName, templateId: '' }));
        return { ...g, items: [...g.items, ...add] };
      })
    );
  const setItemTemplate = (gid: string, columnName: string, templateId: string) =>
    setGroups(prev =>
      prev.map(g => (g.id === gid ? { ...g, items: g.items.map(it => (it.columnName === columnName ? { ...it, templateId } : it)) } : g))
    );
  const removeItem = (gid: string, columnName: string) =>
    setGroups(prev => prev.map(g => (g.id === gid ? { ...g, items: g.items.filter(it => it.columnName !== columnName) } : g)));

  // ── Расчётные ───────────────────────────────────────────────
  const addCalc = () => {
    const name = newCalcName.trim();
    if (!name) return;
    setCalcs(prev => [...prev, { id: rid('calc'), name, formula: 'a/b', operands: {}, displayFormat: 'percent', decimalPlaces: 1, unit: '', normalizeBy: '' }]);
    setNewCalcName('');
  };
  const patchCalc = (id: string, patch: Partial<CalcDraft>) =>
    setCalcs(prev => prev.map(c => (c.id === id ? { ...c, ...patch } : c)));
  const removeCalc = (id: string) => setCalcs(prev => prev.filter(c => c.id !== id));

  // ── Конфиг для импорта ──────────────────────────────────────
  const config = useMemo<RawGroupsConfig | null>(() => {
    const assignments: { columnName: string; groupName: string }[] = [];
    const metricTemplateNames: Record<string, string> = {};
    for (const g of groups) {
      const gname = g.name.trim();
      if (!gname) continue;
      for (const it of g.items) {
        assignments.push({ columnName: it.columnName, groupName: gname });
        const tpl = regById.get(it.templateId);
        if (tpl && tpl.name.trim()) metricTemplateNames[it.columnName] = tpl.name.trim();
      }
    }
    if (assignments.length === 0) return null;

    const metricTemplateSpecs: AggregateTemplateSpec[] = [];
    const seen = new Set<string>();
    for (const t of templates) {
      const name = t.name.trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      const aliases = extractVariables(t.fmt.formula);
      metricTemplateSpecs.push({
        name,
        formula: t.fmt.formula.trim() || 'SUM(value)',
        alias: aliases.length === 1 ? aliases[0] : 'value',
        displayFormat: t.fmt.displayFormat,
        decimalPlaces: t.fmt.decimalPlaces,
        unit: t.fmt.unit.trim() || undefined,
        normalizeBy: t.fmt.normalizeBy || undefined,
        serviceOnly: t.serviceOnly || undefined,
      });
    }

    const calculatedTemplateSpecs: CalculatedTemplateSpec[] = [];
    for (const c of calcs) {
      const name = c.name.trim();
      if (!name) continue;
      const aliases = extractVariables(c.formula);
      if (aliases.length < 1) continue;
      const operands = aliases.map(a => ({ alias: a, indicatorName: c.operands[a] }));
      if (operands.some(o => !o.indicatorName)) continue;
      calculatedTemplateSpecs.push({
        name,
        formula: c.formula.trim(),
        operands,
        displayFormat: c.displayFormat,
        decimalPlaces: c.decimalPlaces,
        unit: c.unit.trim() || undefined,
        normalizeBy: c.normalizeBy || undefined,
      });
    }

    return {
      assignments,
      metricTemplateNames: Object.keys(metricTemplateNames).length ? metricTemplateNames : undefined,
      metricTemplateSpecs: metricTemplateSpecs.length ? metricTemplateSpecs : undefined,
      calculatedTemplateSpecs: calculatedTemplateSpecs.length ? calculatedTemplateSpecs : undefined,
    };
  }, [groups, templates, calcs, regById]);

  useEffect(() => {
    onChange(config);
  }, [config, onChange]);

  if (columns.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        Нет числовых колонок — отметьте нужные колонки типом «Число» выше.
      </p>
    );
  }

  const indicatorSelect = (value: string, onPick: (v: string) => void, emptyLabel: string) => (
    <Select className="h-7 text-[11px] px-2 py-0 flex-1 min-w-0" value={value} onChange={e => onPick(e.target.value)}>
      <SelectOption value="">{emptyLabel}</SelectOption>
      {indicatorNames.map(n => <SelectOption key={n} value={n}>{n}</SelectOption>)}
    </Select>
  );

  return (
    <div className="space-y-5">
      <p className="text-[11px] text-slate-400">
        Создайте переиспользуемые <b>показатели</b> (формула/формат), распределите
        колонки по <b>группам</b> и при желании добавьте <b>расчётные</b> показатели.
        Всё создаётся при импорте — как в агрегатах.
      </p>

      {/* 1. Реестр показателей-шаблонов */}
      <div className="space-y-2">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Показатели (шаблоны)</div>
        <div className="flex gap-2">
          <Input
            value={newTplName}
            onChange={e => setNewTplName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTemplate(); } }}
            placeholder="Имя показателя (напр. «Мощность»)"
            className="h-9 max-w-xs"
          />
          <button type="button" onClick={addTemplate} disabled={!newTplName.trim()}
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40">
            <Plus size={15} /> Показатель
          </button>
        </div>
        {templates.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {templates.map(t => (
              <div key={t.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input value={t.name} onChange={e => patchTemplate(t.id, { name: e.target.value })}
                    className="flex-1 h-8 px-2 text-sm font-medium rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 outline-none focus:ring-1 focus:ring-indigo-500" />
                  <button type="button" onClick={() => removeTemplate(t.id)} title="Удалить показатель" className="text-slate-300 hover:text-rose-500 shrink-0"><X size={15} /></button>
                </div>
                <TemplateFormatFields value={t.fmt} onChange={patch => patchTemplateFmt(t.id, patch)} />
                <label className="flex items-start gap-1.5 text-[11px] text-slate-600 dark:text-slate-300"
                  title="Не выводить как метрику — только операнд расчётных показателей.">
                  <input type="checkbox" checked={t.serviceOnly} onChange={e => patchTemplate(t.id, { serviceOnly: e.target.checked })} className="mt-0.5" />
                  <span>Служебный — только для расчётных (не создавать метрику)</span>
                </label>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Группы — распределение колонок + выбор показателя */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Группы</div>
          <span className="text-[11px] text-slate-400">не распределено: {unassigned.length}</span>
        </div>
        <div className="flex gap-2">
          <Input
            value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addGroup(); } }}
            placeholder="Имя группы (напр. «Финансы»)"
            className="h-9 max-w-xs"
          />
          <button type="button" onClick={addGroup} disabled={!newGroupName.trim()}
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40">
            <Plus size={15} /> Группа
          </button>
        </div>
        {groups.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {groups.map(g => {
              const q = (searchByGroup[g.id] ?? '').trim().toLowerCase();
              const matches = q ? unassigned.filter(c => (c.displayName || c.columnName).toLowerCase().includes(q)) : unassigned;
              const shown = matches.slice(0, 40);
              return (
                <div key={g.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Layers size={14} className="text-indigo-500 shrink-0" />
                    <input value={g.name} onChange={e => patchGroup(g.id, { name: e.target.value })}
                      className="flex-1 h-8 px-2 text-sm font-medium rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 outline-none focus:ring-1 focus:ring-indigo-500" />
                    <span className="text-[11px] text-slate-400 shrink-0">{g.items.length} кол.</span>
                    <button type="button" onClick={() => removeGroup(g.id)} title="Удалить группу" className="text-slate-300 hover:text-rose-500 shrink-0"><X size={15} /></button>
                  </div>

                  {g.items.length > 0 && (
                    <div className="space-y-1">
                      {g.items.map(it => (
                        <div key={it.columnName} className="flex items-center gap-2">
                          <span className="w-32 shrink-0 truncate text-[12px] text-slate-700 dark:text-slate-200" title={it.columnName}>
                            {displayByName.get(it.columnName) ?? it.columnName}
                          </span>
                          <span className="text-slate-300 shrink-0 text-[11px]">→</span>
                          {indicatorSelect(it.templateId ? (regById.get(it.templateId)?.name ?? '') : '', (v) => {
                            // выбор по имени показателя → найти id шаблона
                            const tpl = templates.find(t => t.name.trim() === v);
                            setItemTemplate(g.id, it.columnName, tpl ? tpl.id : '');
                          }, 'по имени колонки')}
                          <button type="button" onClick={() => removeItem(g.id, it.columnName)} title="Убрать" className="text-slate-300 hover:text-rose-500 shrink-0"><X size={13} /></button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={searchByGroup[g.id] ?? ''} onChange={e => setSearchByGroup(prev => ({ ...prev, [g.id]: e.target.value }))}
                      placeholder="найти колонки…"
                      className="w-full h-8 pl-8 pr-2 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 outline-none focus:ring-1 focus:ring-indigo-500" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">подходит: {matches.length}</span>
                    {matches.length > 0 && (
                      <button type="button" onClick={() => assignCols(g.id, matches.map(c => c.columnName))} className="text-[11px] font-medium text-indigo-600 hover:text-indigo-500">
                        Добавить все ({matches.length})
                      </button>
                    )}
                  </div>
                  <div className="space-y-0.5 max-h-40 overflow-auto pr-1">
                    {shown.length === 0 ? (
                      <p className="text-[11px] text-slate-400 py-2 text-center">{unassigned.length === 0 ? 'Все колонки распределены' : 'Ничего не найдено'}</p>
                    ) : (
                      shown.map(c => (
                        <button key={c.columnName} type="button" onClick={() => assignCols(g.id, [c.columnName])} title={c.columnName}
                          className="w-full flex items-center gap-2 px-2 py-1 rounded text-left text-[12px] hover:bg-indigo-50 dark:hover:bg-slate-800 group">
                          <Plus size={12} className="text-slate-300 group-hover:text-indigo-500 shrink-0" />
                          <span className="break-words leading-tight text-slate-600 dark:text-slate-300">{c.displayName || c.columnName}</span>
                        </button>
                      ))
                    )}
                    {matches.length > shown.length && (
                      <p className="text-[11px] text-slate-400 py-1 text-center">…и ещё {matches.length - shown.length}. Уточните поиск.</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Расчётные показатели */}
      <div className="space-y-2">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Calculator size={13} className="text-indigo-500" /> Расчётные показатели
        </div>
        <p className="text-[11px] text-slate-400">
          Формула над показателями, напр. <code>a/b</code>. Создаётся в каждой группе,
          где есть все операнды-показатели. На метрику <code>SUM(...)</code> не применяйте.
        </p>
        <div className="flex gap-2">
          <Input
            value={newCalcName}
            onChange={e => setNewCalcName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCalc(); } }}
            placeholder="Имя расчётного (напр. «Заполненность»)"
            className="h-9 max-w-xs"
          />
          <button type="button" onClick={addCalc} disabled={!newCalcName.trim()}
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40">
            <Plus size={15} /> Расчётный
          </button>
        </div>
        {calcs.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {calcs.map(c => {
              const aliases = extractVariables(c.formula);
              const allBound = aliases.length > 0 && aliases.every(a => c.operands[a]);
              return (
                <div key={c.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input value={c.name} onChange={e => patchCalc(c.id, { name: e.target.value })}
                      className="flex-1 h-8 px-2 text-sm font-medium rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 outline-none focus:ring-1 focus:ring-indigo-500" />
                    <span className={cn('text-[11px] shrink-0', allBound ? 'text-emerald-500' : 'text-amber-500')}>{allBound ? '✓ готов' : 'не привязан'}</span>
                    <button type="button" onClick={() => removeCalc(c.id)} title="Удалить" className="text-slate-300 hover:text-rose-500 shrink-0"><X size={15} /></button>
                  </div>
                  <input value={c.formula} onChange={e => patchCalc(c.id, { formula: e.target.value })} spellCheck={false} placeholder="a/b"
                    className="w-full h-7 px-2 text-[12px] font-mono rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 outline-none focus:ring-1 focus:ring-indigo-500" />
                  {aliases.length === 0 ? (
                    <p className="text-[10px] text-rose-500">Нет полей в формуле (напр. <code>a/b</code>).</p>
                  ) : (
                    <div className="space-y-1">
                      {aliases.map(a => (
                        <div key={a} className="flex items-center gap-2">
                          <code className="text-[11px] w-8 shrink-0 text-indigo-600 dark:text-indigo-300">{a}</code>
                          <span className="text-slate-300 shrink-0">→</span>
                          {indicatorSelect(c.operands[a] ?? '', (v) => patchCalc(c.id, { operands: { ...c.operands, [a]: v } }), '— показатель —')}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <Select className="h-7 text-[11px] px-2 py-0" value={c.displayFormat} onChange={e => patchCalc(c.id, { displayFormat: e.target.value })}>
                      {FORMAT_OPTIONS.map(o => <SelectOption key={o.value} value={o.value}>{o.label}</SelectOption>)}
                    </Select>
                    <div className="flex gap-2">
                      <input type="number" min={0} max={10} value={c.decimalPlaces} title="Знаков после запятой"
                        onChange={e => { const n = parseInt(e.target.value, 10); patchCalc(c.id, { decimalPlaces: isNaN(n) ? 0 : Math.min(10, Math.max(0, n)) }); }}
                        className="h-7 w-14 px-2 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 outline-none focus:ring-1 focus:ring-indigo-500" />
                      <input value={c.unit} onChange={e => patchCalc(c.id, { unit: e.target.value })} placeholder="ед." maxLength={10}
                        className="h-7 flex-1 min-w-0 px-2 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 outline-none focus:ring-1 focus:ring-indigo-500" />
                    </div>
                  </div>
                  <label className="block text-[10px] font-medium text-slate-500">
                    Показывать как
                    <Select className="h-7 text-[11px] px-2 py-0 mt-0.5" value={c.normalizeBy}
                      onChange={e => patchCalc(c.id, { normalizeBy: e.target.value as CalcDraft['normalizeBy'] })}>
                      {NORMALIZE_OPTIONS.map(o => <SelectOption key={o.value} value={o.value}>{o.label}</SelectOption>)}
                    </Select>
                  </label>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
