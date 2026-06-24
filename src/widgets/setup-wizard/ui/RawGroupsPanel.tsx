'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, X, Search, Layers, Sigma } from 'lucide-react';
import { Input } from '@/shared/ui/input';
import { extractVariables } from '@/shared/lib/utils/formula';
import type { AggregateTemplateSpec, RawGroupsConfig } from '@/shared/lib/types/aggregate';
import {
  TemplateFormatFields,
  DEFAULT_TEMPLATE_FORMAT,
  type TemplateFormatValue,
} from './TemplateFormatFields';

/** Колонка-кандидат (числовая) для распределения по группам. */
export interface RawGroupColumn {
  columnName: string;
  displayName: string;
}

interface RawGroupsPanelProps {
  /** Числовые колонки превью (кандидаты в метрики). */
  columns: RawGroupColumn[];
  /** Эмитит конфиг групп наверх (применяется при импорте). null — групп нет. */
  onChange: (config: RawGroupsConfig | null) => void;
}

interface DraftGroup {
  id: string;
  name: string;
  /** Имена колонок (columnName), отнесённые в группу. */
  columns: string[];
}

/**
 * Создание групп показателей для СЫРЫХ данных — ДО импорта (как агрегатная
 * разметка). У сырых нет шапки, поэтому группы задаются вручную и в них
 * распределяются числовые колонки превью. Панель управляемая: эмитит
 * RawGroupsConfig; применение — в syncFromFile тем же ядром, что у агрегата.
 * Каждая колонка — максимум в одной группе.
 */
export function RawGroupsPanel({ columns, onChange }: RawGroupsPanelProps) {
  const displayByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of columns) m.set(c.columnName, c.displayName || c.columnName);
    return m;
  }, [columns]);

  const [groups, setGroups] = useState<DraftGroup[]>([]);
  const [newName, setNewName] = useState('');
  const [searchByGroup, setSearchByGroup] = useState<Record<string, string>>({});
  // Формула/формат на колонку (= её шаблон). Нет записи → дефолт SUM(value)/число.
  const [cfgByColumn, setCfgByColumn] = useState<Record<string, TemplateFormatValue>>({});
  const patchCfg = (col: string, patch: Partial<TemplateFormatValue>) =>
    setCfgByColumn(prev => ({
      ...prev,
      [col]: { ...(prev[col] ?? DEFAULT_TEMPLATE_FORMAT), ...patch },
    }));

  const assigned = useMemo(() => {
    const s = new Set<string>();
    for (const g of groups) for (const c of g.columns) s.add(c);
    return s;
  }, [groups]);
  const unassigned = useMemo(
    () => columns.filter(c => !assigned.has(c.columnName)),
    [columns, assigned]
  );

  // Конфиг для импорта: распределение колонок + спеки формата по имени колонки
  // (= имя показателя; синтетическая колонка в syncFromFile несёт это же имя).
  const config = useMemo<RawGroupsConfig | null>(() => {
    const assignments: { columnName: string; groupName: string }[] = [];
    const specByName = new Map<string, AggregateTemplateSpec>();
    for (const g of groups) {
      const gname = g.name.trim();
      if (!gname) continue;
      for (const col of g.columns) {
        assignments.push({ columnName: col, groupName: gname });
        const cfg = cfgByColumn[col];
        if (cfg && !specByName.has(col)) {
          const aliases = extractVariables(cfg.formula);
          specByName.set(col, {
            name: col, // = имя показателя (templateName синтетической колонки)
            formula: cfg.formula.trim() || 'SUM(value)',
            alias: aliases.length === 1 ? aliases[0] : 'value',
            displayFormat: cfg.displayFormat,
            decimalPlaces: cfg.decimalPlaces,
            unit: cfg.unit.trim() || undefined,
            normalizeBy: cfg.normalizeBy || undefined,
          });
        }
      }
    }
    if (assignments.length === 0) return null;
    return {
      assignments,
      metricTemplateSpecs: specByName.size ? Array.from(specByName.values()) : undefined,
    };
  }, [groups, cfgByColumn]);

  useEffect(() => {
    onChange(config);
  }, [config, onChange]);

  const addGroup = () => {
    const name = newName.trim();
    if (!name) return;
    const id = `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    setGroups(prev => [...prev, { id, name, columns: [] }]);
    setNewName('');
  };
  const renameGroup = (id: string, name: string) =>
    setGroups(prev => prev.map(g => (g.id === id ? { ...g, name } : g)));
  const removeGroup = (id: string) => setGroups(prev => prev.filter(g => g.id !== id));
  const assign = (id: string, cols: string[]) =>
    setGroups(prev =>
      prev.map(g => (g.id === id ? { ...g, columns: Array.from(new Set([...g.columns, ...cols])) } : g))
    );
  const unassign = (id: string, col: string) =>
    setGroups(prev => prev.map(g => (g.id === id ? { ...g, columns: g.columns.filter(c => c !== col) } : g)));

  if (columns.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        Нет числовых колонок — отметьте нужные колонки типом «Число» выше.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-slate-400">
        Создайте группы и распределите числовые колонки. Каждая колонка станет
        метрикой; формулу/формат можно задать тут же. Группы создадутся при импорте.
      </p>

      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addGroup();
            }
          }}
          placeholder="Имя группы (напр. «Финансы»)"
          className="h-9 max-w-xs"
        />
        <button
          type="button"
          onClick={addGroup}
          disabled={!newName.trim()}
          className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={15} /> Создать группу
        </button>
        <span className="self-center text-[11px] text-slate-400">
          не распределено: {unassigned.length}
        </span>
      </div>

      {groups.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {groups.map(g => {
            const q = (searchByGroup[g.id] ?? '').trim().toLowerCase();
            const matches = q
              ? unassigned.filter(c => (c.displayName || c.columnName).toLowerCase().includes(q))
              : unassigned;
            const shown = matches.slice(0, 40);
            return (
              <div
                key={g.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <Layers size={14} className="text-indigo-500 shrink-0" />
                  <input
                    value={g.name}
                    onChange={e => renameGroup(g.id, e.target.value)}
                    className="flex-1 h-8 px-2 text-sm font-medium rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <span className="text-[11px] text-slate-400 shrink-0">{g.columns.length} кол.</span>
                  <button
                    type="button"
                    onClick={() => removeGroup(g.id)}
                    title="Удалить группу"
                    className="text-slate-300 hover:text-rose-500 shrink-0"
                  >
                    <X size={15} />
                  </button>
                </div>

                {g.columns.length > 0 && (
                  <div className="space-y-1">
                    {g.columns.map(col => {
                      const cfg = cfgByColumn[col] ?? DEFAULT_TEMPLATE_FORMAT;
                      return (
                        <div
                          key={col}
                          className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40"
                        >
                          <div className="flex items-center gap-2 px-2 py-1.5">
                            <span
                              className="flex-1 min-w-0 truncate text-[12px] text-slate-700 dark:text-slate-200"
                              title={col}
                            >
                              {displayByName.get(col) ?? col}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400 truncate max-w-[110px]">
                              {cfg.formula}
                            </span>
                            <button
                              type="button"
                              onClick={() => unassign(g.id, col)}
                              title="Убрать из группы"
                              className="text-slate-300 hover:text-rose-500 shrink-0"
                            >
                              <X size={13} />
                            </button>
                          </div>
                          <details>
                            <summary className="cursor-pointer select-none px-2 py-1 text-[10px] font-medium text-slate-500 flex items-center gap-1">
                              <Sigma size={11} className="text-indigo-500" /> Формула и формат
                            </summary>
                            <div className="px-2 pb-2">
                              <TemplateFormatFields value={cfg} onChange={patch => patchCfg(col, patch)} />
                            </div>
                          </details>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={searchByGroup[g.id] ?? ''}
                    onChange={e => setSearchByGroup(prev => ({ ...prev, [g.id]: e.target.value }))}
                    placeholder="найти колонки…"
                    className="w-full h-8 pl-8 pr-2 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">подходит: {matches.length}</span>
                  {matches.length > 0 && (
                    <button
                      type="button"
                      onClick={() => assign(g.id, matches.map(c => c.columnName))}
                      className="text-[11px] font-medium text-indigo-600 hover:text-indigo-500"
                    >
                      Добавить все ({matches.length})
                    </button>
                  )}
                </div>

                <div className="space-y-0.5 max-h-44 overflow-auto pr-1">
                  {shown.length === 0 ? (
                    <p className="text-[11px] text-slate-400 py-2 text-center">
                      {unassigned.length === 0 ? 'Все колонки распределены' : 'Ничего не найдено'}
                    </p>
                  ) : (
                    shown.map(c => (
                      <button
                        key={c.columnName}
                        type="button"
                        onClick={() => assign(g.id, [c.columnName])}
                        title={c.columnName}
                        className="w-full flex items-center gap-2 px-2 py-1 rounded text-left text-[12px] hover:bg-indigo-50 dark:hover:bg-slate-800 group"
                      >
                        <Plus size={12} className="text-slate-300 group-hover:text-indigo-500 shrink-0" />
                        <span className="break-words leading-tight text-slate-600 dark:text-slate-300">
                          {c.displayName || c.columnName}
                        </span>
                      </button>
                    ))
                  )}
                  {matches.length > shown.length && (
                    <p className="text-[11px] text-slate-400 py-1 text-center">
                      …и ещё {matches.length - shown.length}. Уточните поиск.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
