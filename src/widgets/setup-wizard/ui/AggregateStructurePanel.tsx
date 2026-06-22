'use client';

import { useMemo, useState, useEffect } from 'react';
import { Layers, GitBranch, ListTree, Plus, X, Search, Sigma } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Input } from '@/shared/ui/input';
import { Select, SelectOption } from '@/shared/ui/select';
import { extractVariables } from '@/shared/lib/utils/formula';
import {
  detectHeaderRows,
  detectKeyColumns,
  buildColumns,
  classifyRows,
  buildHierarchyPreview,
  type AggregateMatrix,
  type AggregateLayoutConfig,
  type AggregateTemplateSpec,
  type AggregateColumn,
  type ColumnRole,
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

const ROLE_BADGE: Record<ColumnRole, { label: string; cls: string }> = {
  key: { label: 'ключ', cls: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' },
  metric: { label: 'метрика', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  attribute: { label: 'атрибут', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
};

interface DraftTemplate {
  id: string;
  /** Имя логического показателя (= имя будущего шаблона). */
  name: string;
  /** Привязанные колонки (по fullName). Колонка — максимум в одном шаблоне. */
  columns: string[];
  /** Формула шаблона (одновходовая). Дефолт `SUM(value)`. */
  formula: string;
  /** Формат отображения (значение DisplayFormat). */
  displayFormat: string;
  /** Знаков после запятой. */
  decimalPlaces: number;
  /** Единица измерения. */
  unit: string;
}

/** Дефолтная формула шаблона — сумма одного поля. */
const DEFAULT_FORMULA = 'SUM(value)';

/** Быстрый выбор агрегации — пишет `FN(value)`. */
const AGG_FUNCS = ['SUM', 'AVG', 'MIN', 'MAX', 'COUNT', 'MEDIAN'] as const;

/** Форматы отображения (значения DisplayFormat) + подписи. */
const FORMAT_OPTIONS: { value: string; label: string }[] = [
  { value: 'number', label: 'Число (1 234)' },
  { value: 'decimal', label: 'Дробное (1 234,56)' },
  { value: 'percent', label: 'Процент: доля → % (0,57 → 57%)' },
  { value: 'percent_raw', label: 'Процент: готовое (57 → 57%)' },
  { value: 'currency', label: 'Денежное (1 234,56)' },
  { value: 'scientific', label: 'Научное (1.2e3)' },
];

/**
 * Разбор формулы шаблона при импорте. Фаза 1 — только ОДНОВХОДОВЫЕ: ровно один
 * алиас поля (к нему привяжется колонка). 0 алиасов или >1 — пока не поддержано.
 */
function analyzeFormula(formula: string): { valid: boolean; alias: string | null; error?: string } {
  const f = formula.trim();
  if (!f) return { valid: false, alias: null, error: 'Пустая формула' };
  const vars = extractVariables(f);
  if (vars.length === 0) return { valid: false, alias: null, error: 'Нет поля в формуле' };
  if (vars.length > 1)
    return { valid: false, alias: null, error: `Несколько полей (${vars.join(', ')}) — пока только одно` };
  return { valid: true, alias: vars[0] };
}

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

  const { columns, classified, tree } = useMemo(() => {
    const headerMatrix = rawMatrix.slice(0, headerRows);
    const dataRows = rawMatrix.slice(headerRows);
    const cols = buildColumns(headerMatrix, keyColumns, dataRows, emptyCfg);
    const rows = classifyRows(dataRows, keyColumns, { empty: emptyCfg });
    return {
      columns: cols,
      classified: rows,
      tree: buildHierarchyPreview(rows, keyColumns, { empty: emptyCfg, maxNodes: 60 }),
    };
  }, [rawMatrix, headerRows, keyColumns, emptyCfg]);

  // Колонки-метрики по группам (чеклист «какие группы создавать» + счётчики).
  const metricsByGroup = useMemo(() => {
    const m = new Map<string, AggregateColumn[]>();
    for (const c of columns) {
      if (c.role !== 'metric') continue;
      const key = c.groupName || '(без группы)';
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(c);
    }
    return m;
  }, [columns]);

  // Пул колонок-метрик включённых групп — источник привязки к шаблонам.
  const metricColumns = useMemo(
    () =>
      columns.filter(
        c => c.role === 'metric' && !excludedGroups.has(c.groupName || '(без группы)')
      ),
    [columns, excludedGroups]
  );
  const metricColumnSet = useMemo(
    () => new Set(metricColumns.map(c => c.fullName)),
    [metricColumns]
  );
  // fullName → колонка (для двухстрочного показа имени: имя + группа).
  const columnByFullName = useMemo(() => {
    const m = new Map<string, AggregateColumn>();
    for (const c of columns) m.set(c.fullName, c);
    return m;
  }, [columns]);
  // Кандидаты в ключи: не-метрики + уже выбранные ключи. Метрики (их сотни)
  // по умолчанию скрыты — каскад читаемее. Но числовая колонка-ключ (напр.
  // «номер района» 1,2,3…) детектится как метрика, поэтому даём её открыть.
  const [showAllKeyCols, setShowAllKeyCols] = useState(false);
  const hiddenMetricCount = useMemo(
    () => columns.filter(c => c.role === 'metric' && !keyColumns.includes(c.index)).length,
    [columns, keyColumns]
  );
  const keyCandidates = useMemo(
    () =>
      showAllKeyCols
        ? columns
        : columns.filter(c => c.role !== 'metric' || keyColumns.includes(c.index)),
    [columns, keyColumns, showAllKeyCols]
  );

  // ── Шаблоны-первыми: пользователь создаёт шаблоны логических показателей и
  // привязывает к ним колонки поиском. Колонка принадлежит ОДНОМУ шаблону.
  const [templates, setTemplates] = useState<DraftTemplate[]>([]);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [searchByTemplate, setSearchByTemplate] = useState<Record<string, string>>({});
  // Импортировать ли колонки, не привязанные к шаблонам (по умолчанию — да).
  const [importUnassigned, setImportUnassigned] = useState(true);

  const assigned = useMemo(() => {
    const s = new Set<string>();
    for (const t of templates) for (const col of t.columns) s.add(col);
    return s;
  }, [templates]);
  const unassignedColumns = useMemo(
    () => metricColumns.filter(c => !assigned.has(c.fullName)),
    [metricColumns, assigned]
  );

  const addTemplate = () => {
    const name = newTemplateName.trim();
    if (!name) return;
    const id = `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    setTemplates(prev => [
      ...prev,
      { id, name, columns: [], formula: DEFAULT_FORMULA, displayFormat: 'number', decimalPlaces: 2, unit: '' },
    ]);
    setSearchByTemplate(prev => ({ ...prev, [id]: name })); // поиск преднабит именем
    setNewTemplateName('');
  };
  const renameTemplate = (id: string, name: string) =>
    setTemplates(prev => prev.map(t => (t.id === id ? { ...t, name } : t)));
  const patchTemplate = (id: string, patch: Partial<DraftTemplate>) =>
    setTemplates(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)));
  const removeTemplate = (id: string) =>
    setTemplates(prev => prev.filter(t => t.id !== id));
  const assignColumns = (id: string, fulls: string[]) =>
    setTemplates(prev =>
      prev.map(t =>
        t.id === id ? { ...t, columns: Array.from(new Set([...t.columns, ...fulls])) } : t
      )
    );
  const unassignColumn = (id: string, full: string) =>
    setTemplates(prev =>
      prev.map(t => (t.id === id ? { ...t, columns: t.columns.filter(c => c !== full) } : t))
    );

  // fullName → имя шаблона для импорта (только колонки включённых групп,
  // привязанные к непустому шаблону). Непривязанные падают на имя колонки.
  const metricTemplateNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of templates) {
      const name = t.name.trim();
      if (!name) continue;
      for (const col of t.columns) if (metricColumnSet.has(col)) map[col] = name;
    }
    return map;
  }, [templates, metricColumnSet]);

  // Спецификации шаблонов (формула + формат) для импорта. Только шаблоны с
  // именем и валидной одновходовой формулой; иначе createAggregateGroups
  // откатится на дефолт SUM(value).
  const metricTemplateSpecs = useMemo<AggregateTemplateSpec[]>(() => {
    const specs: AggregateTemplateSpec[] = [];
    for (const t of templates) {
      const name = t.name.trim();
      if (!name) continue;
      const a = analyzeFormula(t.formula);
      if (!a.valid || !a.alias) continue;
      specs.push({
        name,
        formula: t.formula.trim(),
        alias: a.alias,
        displayFormat: t.displayFormat,
        decimalPlaces: t.decimalPlaces,
        unit: t.unit.trim() || undefined,
      });
    }
    return specs;
  }, [templates]);

  // Сообщаем разметку наверх — для импорта.
  useEffect(() => {
    onLayoutChange?.({
      headerRows,
      keyColumns,
      empty: emptyCfg,
      excludeGroups: Array.from(excludedGroups),
      metricTemplateNames,
      importUnassignedMetrics: importUnassigned,
      metricTemplateSpecs,
    });
  }, [headerRows, keyColumns, emptyCfg, excludedGroups, metricTemplateNames, importUnassigned, metricTemplateSpecs, onLayoutChange]);

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
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            <GitBranch size={12} /> Ключевые колонки (каскад уровней)
          </div>
          {(hiddenMetricCount > 0 || showAllKeyCols) && (
            <button
              type="button"
              onClick={() => setShowAllKeyCols(v => !v)}
              className="text-[11px] font-medium text-indigo-600 hover:text-indigo-500 shrink-0"
            >
              {showAllKeyCols ? 'Скрыть числовые' : `+ числовые колонки (${hiddenMetricCount})`}
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {keyCandidates.map(col => {
            const isKey = keyColumns.includes(col.index);
            const hasGroup = !!col.groupName && col.groupName !== col.name;
            return (
              <button
                key={col.index}
                type="button"
                onClick={() => toggleKey(col.index)}
                title={`${col.fullName} · ${col.role}`}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs border transition-colors text-left max-w-[280px]',
                  isKey
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                )}
              >
                {hasGroup && (
                  <span className={cn('block text-[10px] leading-tight', isKey ? 'text-indigo-100/80' : 'text-slate-400')}>
                    {col.groupName}
                  </span>
                )}
                <span className="block break-words leading-tight">{col.name || `колонка ${col.index + 1}`}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-400">
          Глубина строки = самый правый заполненный ключ. Лист = заполнен самый глубокий ключ.
          Числовые колонки скрыты; если ключ — число (напр. номер района),
          нажмите «+ числовые колонки» и отметьте его.
        </p>
      </div>

      {/* Все колонки — полный список с ролью (свернуто) */}
      <details className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <summary className="cursor-pointer select-none px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          Все колонки ({columns.length})
        </summary>
        <div className="max-h-72 overflow-auto border-t border-slate-100 dark:border-slate-800">
          <table className="min-w-full text-[12px]">
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {columns.map(col => {
                const badge = ROLE_BADGE[col.role];
                return (
                  <tr key={col.index}>
                    <td className="px-3 py-1.5 w-10 text-slate-400 align-top">{col.index + 1}</td>
                    <td className="px-3 py-1.5 w-20 align-top">
                      <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', badge.cls)}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-slate-400 align-top break-words max-w-[200px]">
                      {col.groupName || '—'}
                    </td>
                    <td className="px-3 py-1.5 text-slate-700 dark:text-slate-200 align-top break-words">
                      {col.name || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>

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
            Группы к созданию ({metricsByGroup.size})
          </div>
          <p className="text-[11px] text-slate-400">
            Снимите галочку, чтобы не создавать группу. Её метрики не попадут в шаблоны.
          </p>
          <div className="space-y-1 max-h-[360px] overflow-auto pr-1">
            {Array.from(metricsByGroup.entries()).map(([name, cols]) => (
              <label
                key={name}
                className="flex items-center gap-2 cursor-pointer rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1.5"
              >
                <input
                  type="checkbox"
                  checked={!excludedGroups.has(name)}
                  onChange={() => toggleGroup(name)}
                />
                <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                  {name}
                </span>
                <span className="text-[11px] text-slate-400 ml-auto shrink-0">
                  {cols.length} метрик
                </span>
              </label>
            ))}
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

      {/* Шаблоны показателей — создание + привязка колонок поиском */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Шаблоны показателей
          </div>
          <span className="text-[11px] text-slate-400">
            шаблонов: {templates.length} · не распределено: {unassignedColumns.length}
          </span>
        </div>
        <p className="text-[11px] text-slate-400">
          Создайте шаблон логического показателя (Потребность, Мощность…) и
          привяжите к нему колонки поиском. Колонка принадлежит одному шаблону.
        </p>

        <label className="flex items-start gap-2 text-[12px] text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2">
          <input
            type="checkbox"
            checked={importUnassigned}
            onChange={e => setImportUnassigned(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Импортировать колонки без шаблона ({unassignedColumns.length}) — каждая
            станет отдельным показателем по своему имени.
            <span className="block text-[11px] text-slate-400">
              Снимите галочку, чтобы импортировать только привязанные к шаблонам величины.
            </span>
          </span>
        </label>

        <div className="flex gap-2">
          <Input
            value={newTemplateName}
            onChange={e => setNewTemplateName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTemplate();
              }
            }}
            placeholder="Имя показателя (шаблона)"
            className="h-9 max-w-xs"
          />
          <button
            type="button"
            onClick={addTemplate}
            disabled={!newTemplateName.trim()}
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={15} /> Создать шаблон
          </button>
        </div>

        {templates.length === 0 ? (
          <p className="text-sm text-slate-400 px-1 py-4">
            Шаблонов пока нет. Создайте первый — например «{metricColumns[0]?.name || 'Потребность'}».
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {templates.map(t => {
              const q = (searchByTemplate[t.id] ?? '').trim().toLowerCase();
              const matches = q
                ? unassignedColumns.filter(c => c.fullName.toLowerCase().includes(q))
                : unassignedColumns;
              const shown = matches.slice(0, 40);
              const formulaInfo = analyzeFormula(t.formula);
              return (
                <div
                  key={t.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <input
                      value={t.name}
                      onChange={e => renameTemplate(t.id, e.target.value)}
                      className="flex-1 h-8 px-2 text-sm font-medium rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <span className="text-[11px] text-slate-400 shrink-0">{t.columns.length} кол.</span>
                    <button
                      type="button"
                      onClick={() => removeTemplate(t.id)}
                      title="Удалить шаблон"
                      className="text-slate-300 hover:text-rose-500 shrink-0"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  {t.columns.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {t.columns.map(full => {
                        const col = columnByFullName.get(full);
                        const hasGroup = !!col?.groupName && col.groupName !== col.name;
                        return (
                          <span
                            key={full}
                            title={full}
                            className="inline-flex items-start gap-1 max-w-full px-2 py-1 rounded-md text-[11px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900"
                          >
                            <span className="min-w-0">
                              {hasGroup && (
                                <span className="block text-[10px] leading-tight text-indigo-400 dark:text-indigo-400/70">
                                  {col!.groupName}
                                </span>
                              )}
                              <span className="block break-words leading-tight">{col?.name || full}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => unassignColumn(t.id, full)}
                              className="hover:text-rose-500 shrink-0 mt-0.5"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Формула и формат шаблона (одновходовая) */}
                  <details className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
                    <summary className="cursor-pointer select-none px-2.5 py-1.5 text-[11px] font-medium text-slate-500 flex items-center gap-1.5">
                      <Sigma size={12} className="text-indigo-500" />
                      Формула и формат
                      <span className="ml-auto font-mono text-[10px] text-slate-400 truncate max-w-[150px]">
                        {t.formula}
                      </span>
                    </summary>
                    <div className="px-2.5 pb-2.5 pt-1 space-y-2">
                      <div className="flex flex-wrap gap-1">
                        {AGG_FUNCS.map(fn => {
                          const active = t.formula.trim() === `${fn}(value)`;
                          return (
                            <button
                              key={fn}
                              type="button"
                              onClick={() => patchTemplate(t.id, { formula: `${fn}(value)` })}
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
                        value={t.formula}
                        onChange={e => patchTemplate(t.id, { formula: e.target.value })}
                        spellCheck={false}
                        className={cn(
                          'w-full h-7 px-2 text-[12px] font-mono rounded border bg-white dark:bg-slate-950 outline-none focus:ring-1',
                          formulaInfo.valid
                            ? 'border-slate-200 dark:border-slate-700 focus:ring-indigo-500'
                            : 'border-rose-300 dark:border-rose-800 focus:ring-rose-500'
                        )}
                      />
                      {formulaInfo.valid ? (
                        <p className="text-[10px] text-slate-400">
                          Каждая колонка привяжется к полю <code>{formulaInfo.alias}</code>.
                        </p>
                      ) : (
                        <p className="text-[10px] text-rose-500">
                          {formulaInfo.error}. При импорте будет использован <code>SUM(value)</code>.
                        </p>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <Select
                          className="h-7 text-[11px] px-2 py-0"
                          value={t.displayFormat}
                          onChange={e => patchTemplate(t.id, { displayFormat: e.target.value })}
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
                            value={t.decimalPlaces}
                            title="Знаков после запятой"
                            onChange={e => {
                              const n = parseInt(e.target.value, 10);
                              patchTemplate(t.id, { decimalPlaces: isNaN(n) ? 0 : Math.min(10, Math.max(0, n)) });
                            }}
                            className="h-7 w-14 px-2 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <input
                            value={t.unit}
                            onChange={e => patchTemplate(t.id, { unit: e.target.value })}
                            placeholder="ед."
                            maxLength={10}
                            className="h-7 flex-1 min-w-0 px-2 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    </div>
                  </details>

                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={searchByTemplate[t.id] ?? ''}
                      onChange={e =>
                        setSearchByTemplate(prev => ({ ...prev, [t.id]: e.target.value }))
                      }
                      placeholder="найти колонки…"
                      className="w-full h-8 pl-8 pr-2 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">подходит: {matches.length}</span>
                    {matches.length > 0 && (
                      <button
                        type="button"
                        onClick={() => assignColumns(t.id, matches.map(c => c.fullName))}
                        className="text-[11px] font-medium text-indigo-600 hover:text-indigo-500"
                      >
                        Добавить все ({matches.length})
                      </button>
                    )}
                  </div>

                  <div className="space-y-0.5 max-h-44 overflow-auto pr-1">
                    {shown.length === 0 ? (
                      <p className="text-[11px] text-slate-400 py-2 text-center">
                        {unassignedColumns.length === 0 ? 'Все колонки распределены' : 'Ничего не найдено'}
                      </p>
                    ) : (
                      shown.map(c => {
                        const hasGroup = !!c.groupName && c.groupName !== c.name;
                        return (
                          <button
                            key={c.fullName}
                            type="button"
                            onClick={() => assignColumns(t.id, [c.fullName])}
                            title={c.fullName}
                            className="w-full flex items-start gap-2 px-2 py-1 rounded text-left text-[12px] hover:bg-indigo-50 dark:hover:bg-slate-800 group"
                          >
                            <Plus size={12} className="text-slate-300 group-hover:text-indigo-500 shrink-0 mt-0.5" />
                            <span className="min-w-0">
                              {hasGroup && (
                                <span className="block text-[10px] leading-tight text-slate-400">{c.groupName}</span>
                              )}
                              <span className="block break-words leading-tight text-slate-600 dark:text-slate-300">
                                {c.name || `колонка ${c.index + 1}`}
                              </span>
                            </span>
                          </button>
                        );
                      })
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
    </div>
  );
}
