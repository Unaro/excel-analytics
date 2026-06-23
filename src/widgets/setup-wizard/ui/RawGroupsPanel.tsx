'use client';

import { useMemo, useState } from 'react';
import { Plus, X, Search, Layers, Sigma } from 'lucide-react';
import { Input } from '@/shared/ui/input';
import { toast } from '@/shared/ui/toast';
import { useColumnConfigStore } from '@/entities/column-config';
import { extractVariables } from '@/shared/lib/utils/formula';
import {
  createAggregateGroups,
  type AggregateColumn,
  type AggregateTemplateSpec,
} from '@/features/setup-dataset';
import {
  TemplateFormatFields,
  DEFAULT_TEMPLATE_FORMAT,
  type TemplateFormatValue,
} from './TemplateFormatFields';

interface RawGroupsPanelProps {
  datasetId: string;
}

interface DraftGroup {
  id: string;
  name: string;
  /** Имена колонок (columnName), отнесённые в группу. */
  columns: string[];
}

/**
 * Создание групп показателей при импорте СЫРЫХ данных (Фаза 3 единого импорта).
 * У сырых нет шапки-заголовков, поэтому группы пользователь задаёт вручную и
 * распределяет в них числовые колонки. Применение — общий createAggregateGroups
 * с синтетическими колонками (groupName = группа, fullName = имя колонки).
 * Каждая колонка — максимум в одной группе (как в агрегатной панели).
 */
export function RawGroupsPanel({ datasetId }: RawGroupsPanelProps) {
  const configs = useColumnConfigStore(s => s.configsByDataset[datasetId]);
  const numericColumns = useMemo(
    () => (configs ?? []).filter(c => c.classification === 'numeric'),
    [configs]
  );
  const displayByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of numericColumns) m.set(c.columnName, c.displayName || c.columnName);
    return m;
  }, [numericColumns]);

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
    () => numericColumns.filter(c => !assigned.has(c.columnName)),
    [numericColumns, assigned]
  );

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

  const handleCreate = () => {
    const synth: AggregateColumn[] = [];
    let idx = 0;
    for (const g of groups) {
      const name = g.name.trim();
      if (!name) continue;
      for (const col of g.columns) {
        synth.push({
          index: idx++,
          groupName: name,
          name: displayByName.get(col) ?? col,
          fullName: col, // имя колонки в БД — к нему привяжется метрика
          role: 'metric',
        });
      }
    }
    if (synth.length === 0) {
      toast.error('Назначьте колонки хотя бы в одну группу');
      return;
    }
    // Спеки шаблонов (формула/формат) по имени показателя (= displayName колонки).
    const specByName = new Map<string, AggregateTemplateSpec>();
    for (const g of groups) {
      for (const col of g.columns) {
        const cfg = cfgByColumn[col];
        if (!cfg) continue; // дефолт → createAggregateGroups сам поставит SUM(value)
        const name = displayByName.get(col) ?? col;
        if (specByName.has(name)) continue;
        const aliases = extractVariables(cfg.formula);
        specByName.set(name, {
          name,
          formula: cfg.formula.trim() || 'SUM(value)',
          alias: aliases.length === 1 ? aliases[0] : 'value',
          displayFormat: cfg.displayFormat,
          decimalPlaces: cfg.decimalPlaces,
          unit: cfg.unit.trim() || undefined,
          normalizeBy: cfg.normalizeBy || undefined,
        });
      }
    }
    const n = createAggregateGroups(
      datasetId, synth, undefined, undefined, true, Array.from(specByName.values())
    );
    toast.success(`Создано групп: ${n}. Донастройте в разделе «Группы».`);
    setGroups([]);
    setSearchByGroup({});
    setCfgByColumn({});
  };

  // Нет числовых колонок — группировать нечего (раздел не показываем).
  if (numericColumns.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Необязательно: создайте группы показателей прямо сейчас и распределите в них
        числовые колонки. Каждая колонка станет метрикой (сумма по колонке) —
        формулы и формат можно донастроить в разделе «Группы».
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

      {groups.some(g => g.columns.length > 0) && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleCreate}
            className="inline-flex items-center gap-1.5 px-4 h-9 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-500"
          >
            Создать группы
          </button>
        </div>
      )}
    </div>
  );
}
