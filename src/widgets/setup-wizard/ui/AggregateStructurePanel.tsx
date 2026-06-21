'use client';

import { useMemo, useState, useEffect } from 'react';
import { Layers, GitBranch, ListTree } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Input } from '@/shared/ui/input';
import {
  detectHeaderRows,
  detectKeyColumns,
  buildColumns,
  classifyRows,
  buildHierarchyPreview,
  proposeGroups,
  type AggregateMatrix,
  type AggregateLayoutConfig,
  type EmptyConfig,
  type HierarchyPreviewNode,
  type RowKind,
} from '@/features/setup-dataset';

interface AggregateStructurePanelProps {
  matrix: AggregateMatrix | null;
  /** Сообщает подтверждённую разметку наверх (для импорта фазы 1). */
  onLayoutChange?: (config: AggregateLayoutConfig) => void;
}

const KIND_BADGE: Record<RowKind, { label: string; cls: string }> = {
  leaf: { label: 'лист', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  node: { label: 'узел', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  total: { label: 'итого', cls: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' },
};

/** Рекурсивный рендер дерева иерархии (предпросмотр). */
function TreeNodes({ nodes, depth = 0 }: { nodes: HierarchyPreviewNode[]; depth?: number }) {
  return (
    <ul className={cn(depth > 0 && 'ml-4 border-l border-slate-200 dark:border-slate-700 pl-3')}>
      {nodes.map((n, i) => (
        <li key={`${n.label}-${i}`} className="py-0.5">
          <span className="text-sm text-slate-700 dark:text-slate-200">{n.label || '∅'}</span>
          {n.children.length > 0 && <TreeNodes nodes={n.children} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  );
}

/**
 * Предпросмотр структуры файла-агрегата (мега-босс, фаза 0).
 * Показывает best-effort разметку (каскад ключей, классификация строк,
 * группы, дерево) и даёт её подправить. На импорт пока НЕ влияет — это
 * валидация детекта на реальных файлах. План: docs/architecture/aggregate-files.md
 */
export function AggregateStructurePanel({ matrix, onLayoutChange }: AggregateStructurePanelProps) {
  const rawMatrix = useMemo(() => matrix?.matrix ?? [], [matrix]);

  const [headerRows, setHeaderRows] = useState(1);
  const [keyColumns, setKeyColumns] = useState<number[]>([]);
  const [emptyTokensText, setEmptyTokensText] = useState('');

  // Автодетект при смене файла (best-effort, дальше пользователь правит).
  useEffect(() => {
    if (rawMatrix.length === 0) return;
    const hr = detectHeaderRows(rawMatrix);
    setHeaderRows(hr);
    const dataRows = rawMatrix.slice(hr);
    const columnCount = Math.max(0, ...rawMatrix.map(r => r.length));
    setKeyColumns(detectKeyColumns(dataRows, columnCount));
  }, [rawMatrix]);

  const emptyCfg = useMemo<EmptyConfig>(() => {
    const tokens = emptyTokensText.split(',').map(t => t.trim()).filter(Boolean);
    return tokens.length ? { tokens } : {};
  }, [emptyTokensText]);

  // Выбор групп к созданию (фаза 1 — снятый чекбокс = не создавать).
  const [excludedGroups, setExcludedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (name: string) =>
    setExcludedGroups(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });

  // Сообщаем разметку наверх — для импорта (фаза 1).
  useEffect(() => {
    onLayoutChange?.({
      headerRows,
      keyColumns,
      empty: emptyCfg,
      excludeGroups: Array.from(excludedGroups),
    });
  }, [headerRows, keyColumns, emptyCfg, excludedGroups, onLayoutChange]);

  const { columns, classified, groups, tree } = useMemo(() => {
    const headerMatrix = rawMatrix.slice(0, headerRows);
    const dataRows = rawMatrix.slice(headerRows);
    const cols = buildColumns(headerMatrix, keyColumns, dataRows, emptyCfg);
    const rows = classifyRows(dataRows, keyColumns, { empty: emptyCfg });
    return {
      columns: cols,
      classified: rows,
      groups: proposeGroups(cols),
      tree: buildHierarchyPreview(rows, keyColumns, { empty: emptyCfg, maxNodes: 60 }),
    };
  }, [rawMatrix, headerRows, keyColumns, emptyCfg]);

  const toggleKey = (index: number) =>
    setKeyColumns(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index].sort((a, b) => a - b)
    );

  if (rawMatrix.length === 0) {
    return (
      <div className="text-sm text-slate-400 p-4">Нет данных для разметки структуры.</div>
    );
  }

  const sample = classified.slice(0, 14);

  return (
    <div className="space-y-5 p-4 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/10">
      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
        <Layers size={16} />
        <span className="text-sm font-semibold">Структура файла-агрегата (предпросмотр)</span>
        <span className="text-[11px] text-amber-600/70 dark:text-amber-400/60">
          валидация детекта — на импорт пока не влияет
        </span>
      </div>

      {/* Контролы разметки */}
      <div className="flex flex-wrap gap-4">
        <label className="space-y-1">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">Строк шапки</span>
          <Input
            type="number" min={1} max={4}
            value={headerRows}
            onChange={e => setHeaderRows(Math.max(1, Math.min(4, Number(e.target.value) || 1)))}
            className="h-9 w-24"
          />
        </label>
        <label className="space-y-1 flex-1 min-w-[220px]">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block">
            Считать пустотой (через запятую; 0 — всегда значение)
          </span>
          <Input
            value={emptyTokensText}
            onChange={e => setEmptyTokensText(e.target.value)}
            placeholder="напр.: —, н/д, -"
            className="h-9"
          />
        </label>
      </div>

      {/* Каскад ключевых колонок */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          <GitBranch size={12} /> Ключевые колонки (каскад уровней)
        </div>
        <div className="flex flex-wrap gap-1.5">
          {columns.map(col => {
            const isKey = keyColumns.includes(col.index);
            return (
              <button
                key={col.index}
                type="button"
                onClick={() => toggleKey(col.index)}
                title={`${col.fullName} · ${col.role}`}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs border transition-colors max-w-[180px] truncate',
                  isKey
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                )}
              >
                {col.fullName || `колонка ${col.index + 1}`}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-400">
          Глубина строки = самый правый заполненный ключ. Лист = заполнен самый глубокий ключ.
        </p>
      </div>

      {/* Классификация строк (сэмпл) */}
      <div className="space-y-2">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Строки (сэмпл)</div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
          <table className="min-w-full text-sm">
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {sample.map((r, i) => {
                const badge = KIND_BADGE[r.kind];
                return (
                  <tr key={i}>
                    <td className="px-3 py-1.5 w-16 text-[11px] text-slate-400">ур. {r.level}</td>
                    <td className="px-3 py-1.5 w-20">
                      <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', badge.cls)}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-slate-700 dark:text-slate-200 truncate max-w-[320px]" title={r.label}>
                      {r.label || <span className="text-slate-300 dark:text-slate-600">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Группы к созданию */}
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Группы показателей ({groups.length})
          </div>
          <div className="space-y-1.5">
            {groups.map(g => {
              const name = g.groupName || '(без группы)';
              const included = !excludedGroups.has(name);
              return (
                <label
                  key={name}
                  className="flex items-start gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={included}
                    onChange={() => toggleGroup(name)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{name}</div>
                    <div className="text-[11px] text-slate-400 truncate" title={g.metrics.join(', ')}>
                      {g.metrics.length} метрик: {g.metrics.join(', ')}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Дерево иерархии */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            <ListTree size={12} /> Предварительная иерархия
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 max-h-[320px] overflow-auto">
            {tree.length > 0 ? (
              <TreeNodes nodes={tree} />
            ) : (
              <span className="text-sm text-slate-400">Дерево не построено — проверьте каскад ключей.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
