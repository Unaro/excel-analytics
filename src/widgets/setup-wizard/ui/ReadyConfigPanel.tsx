'use client';

import { useRef } from 'react';
import { Upload, AlertTriangle, FileJson, Layers, Calculator, LayoutDashboard } from 'lucide-react';
import { Input } from '@/shared/ui/input';
import { cn } from '@/shared/lib/utils';
import type { DatasetConfigExportParsed } from '@/shared/lib/validators';
import type { ConfigFileValidation } from '@/features/setup-dataset';
import type { ConfigSelection } from '../model/types';

interface ReadyConfigPanelProps {
  config: DatasetConfigExportParsed | null;
  selection: ConfigSelection | null;
  validation: ConfigFileValidation | null;
  onLoadConfig: (file: File) => void;
  onToggleItem: (kind: 'group' | 'template' | 'dashboard', id: string) => void;
  onRenameItem: (id: string, name: string) => void;
}

interface NamedItem {
  id: string;
  name: string;
}

function dashboardItems(config: DatasetConfigExportParsed): NamedItem[] {
  return (config.data.dashboards ?? [])
    .map((d) => d as { id?: unknown; name?: unknown })
    .filter((d): d is { id: string; name?: unknown } => typeof d.id === 'string')
    .map((d) => ({ id: d.id, name: typeof d.name === 'string' ? d.name : d.id }));
}

/**
 * Панель «готовой конфигурации»: загрузка JSON, выбор включаемых групп/шаблонов/
 * дашбордов (чекбоксы + переименование), предупреждения сверки с файлом.
 * Не блокирует импорт — пользователь решает применить частично или сменить конфиг.
 */
export function ReadyConfigPanel({
  config,
  selection,
  validation,
  onLoadConfig,
  onToggleItem,
  onRenameItem,
}: ReadyConfigPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pick = () => inputRef.current?.click();

  const hiddenInput = (
    <input
      ref={inputRef}
      type="file"
      accept=".json"
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) onLoadConfig(f);
        e.target.value = '';
      }}
    />
  );

  if (!config || !selection) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center space-y-3">
        {hiddenInput}
        <FileJson className="mx-auto text-indigo-400" size={32} />
        <div className="text-sm text-slate-600 dark:text-slate-300">
          Загрузите JSON-конфиг (экспорт настроек датасета) — группы, метрики, шаблоны и дашборды
          применятся к этому файлу автоматически.
        </div>
        <button
          type="button"
          onClick={pick}
          className="inline-flex items-center gap-2 px-4 h-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium"
        >
          <Upload size={15} /> Выбрать JSON-конфиг
        </button>
      </div>
    );
  }

  const groups: NamedItem[] = (config.data.indicatorGroups ?? []).map((g) => ({ id: g.id, name: g.name }));
  const templates: NamedItem[] = (config.data.metricTemplates ?? []).map((t) => ({ id: t.id, name: t.name }));
  const dashboards = dashboardItems(config);

  const renameValue = (id: string, fallback: string) =>
    id in selection.renames ? selection.renames[id] : fallback;

  const row = (
    kind: 'group' | 'template' | 'dashboard',
    item: NamedItem,
    checked: boolean,
    canRename: boolean
  ) => (
    <div key={item.id} className="flex items-center gap-2 py-1">
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggleItem(kind, item.id)}
        className="shrink-0"
      />
      {canRename ? (
        <Input
          value={renameValue(item.id, item.name)}
          onChange={(e) => onRenameItem(item.id, e.target.value)}
          disabled={!checked}
          className={cn('h-7 text-[12px] flex-1', !checked && 'opacity-50')}
        />
      ) : (
        <span className={cn('text-[12px] flex-1 truncate', !checked && 'opacity-50')}>{item.name}</span>
      )}
    </div>
  );

  const section = (
    title: string,
    icon: React.ReactNode,
    kind: 'group' | 'template' | 'dashboard',
    items: NamedItem[],
    selected: Set<string>,
    canRename: boolean
  ) => {
    if (items.length === 0) return null;
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
        <div className="flex items-center gap-2 mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
          {icon} {title}
          <span className="ml-auto font-normal normal-case text-slate-400">
            выбрано {items.filter((i) => selected.has(i.id)).length} из {items.length}
          </span>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
          {items.map((i) => row(kind, i, selected.has(i.id), canRename))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {hiddenInput}

      {validation && !validation.ok && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 space-y-1.5">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 text-sm font-medium">
            <AlertTriangle size={15} /> Конфиг не полностью соответствует файлу
          </div>
          {validation.missingColumns.length > 0 && (
            <div className="text-[12px] text-amber-700 dark:text-amber-300/90">
              Нет колонок в файле: {validation.missingColumns.join(', ')}
            </div>
          )}
          {validation.layoutIssues.map((issue, i) => (
            <div key={i} className="text-[12px] text-amber-700 dark:text-amber-300/90">{issue}</div>
          ))}
          <div className="text-[11px] text-amber-600/80 dark:text-amber-400/70">
            Импорт доступен — несоответствующие элементы применятся частично или будут пустыми.
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-[12px] text-slate-500">
          Источник: <span className="font-medium">{config.sourceDatasetId}</span>
        </div>
        <button type="button" onClick={pick} className="text-[12px] text-indigo-600 hover:text-indigo-500 inline-flex items-center gap-1">
          <Upload size={13} /> Другой конфиг
        </button>
      </div>

      {section('Группы показателей', <Layers size={13} />, 'group', groups, selection.groupIds, true)}
      {section('Шаблоны метрик', <Calculator size={13} />, 'template', templates, selection.templateIds, false)}
      {section('Дашборды', <LayoutDashboard size={13} />, 'dashboard', dashboards, selection.dashboardIds, true)}
    </div>
  );
}
