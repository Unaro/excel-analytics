'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useIndicatorGroupStore } from '@/entities/indicator-group';
import { useDatasetStore } from '@/entities/dataset';
import { useDeleteGroup } from '@/features/delete-group';
import { Plus, Layers, Edit, Trash2, Database, ArrowUpRight, Search, Unlink } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { LoadingScreen } from '@/shared/ui/loading-screen';
import { ClientOnly } from '@/shared/ui/client-only';
import { cn } from '@/shared/lib/utils';
import type { IndicatorGroup } from '@/shared/lib/validators';

export function GroupListWidget() {
  return (
    <ClientOnly fallback={<LoadingScreen message="Загрузка списка групп..." />}>
      <GroupListContent />
    </ClientOnly>
  );
}

/** Спец-ключ вкладки для групп без привязки к существующему датасету. */
const UNBOUND = '__unbound__';

interface Tab {
  id: string;
  name: string;
  count: number;
}

function GroupListContent() {
  const groups = useIndicatorGroupStore(s => s.groups);
  const datasets = useDatasetStore(s => s.datasets);
  const activeDatasetId = useDatasetStore(s => s.activeDatasetId);
  const {
    isConfirming,
    affectedDashboards,
    requestDelete,
    cancelDelete,
    confirmDelete,
  } = useDeleteGroup();

  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Группировка по датасету: «привязанные» (datasetId есть и датасет жив) и
  // сироты (без datasetId или датасет удалён → отдельная вкладка).
  const { byDataset, unbound } = useMemo(() => {
    const byDataset = new Map<string, IndicatorGroup[]>();
    const unbound: IndicatorGroup[] = [];
    for (const g of groups) {
      if (g.datasetId && datasets[g.datasetId]) {
        const list = byDataset.get(g.datasetId) ?? [];
        list.push(g);
        byDataset.set(g.datasetId, list);
      } else {
        unbound.push(g);
      }
    }
    return { byDataset, unbound };
  }, [groups, datasets]);

  // Вкладки: датасеты с группами + активный (даже пустой, чтобы было где создать).
  // Активный — первым, остальные по имени.
  const tabs = useMemo<Tab[]>(() => {
    const ids = new Set(byDataset.keys());
    if (activeDatasetId && datasets[activeDatasetId]) ids.add(activeDatasetId);
    return [...ids]
      .map(id => ({ id, name: datasets[id]?.name ?? id, count: byDataset.get(id)?.length ?? 0 }))
      .sort((a, b) =>
        a.id === activeDatasetId ? -1 : b.id === activeDatasetId ? 1 : a.name.localeCompare(b.name)
      );
  }, [byDataset, datasets, activeDatasetId]);

  const tabIds = useMemo(
    () => [...tabs.map(t => t.id), ...(unbound.length > 0 ? [UNBOUND] : [])],
    [tabs, unbound.length]
  );

  // Текущая вкладка: выбор пользователя, иначе активный датасет, иначе первая.
  const current =
    selected && tabIds.includes(selected)
      ? selected
      : activeDatasetId && tabIds.includes(activeDatasetId)
        ? activeDatasetId
        : tabIds[0] ?? null;

  const tabGroups = current === UNBOUND ? unbound : current ? byDataset.get(current) ?? [] : [];
  const q = search.trim().toLowerCase();
  const visibleGroups = q
    ? tabGroups.filter(g => g.name.toLowerCase().includes(q))
    : tabGroups;

  const hasAnyGroups = groups.length > 0;

  return (
    <>
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              Группы показателей
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Логические блоки (строки таблицы) — по датасетам
            </p>
          </div>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white"
            asChild
          >
            <Link href="/groups/new">
              <Plus size={18} className="mr-2" /> Новая группа
            </Link>
          </Button>
        </div>

        {!hasAnyGroups ? (
          <Card className="p-12 text-center border-dashed">
            <p className="text-slate-500">Нет групп</p>
          </Card>
        ) : (
          <>
            {/* Вкладки датасетов + сироты */}
            <div className="flex flex-wrap items-center gap-2">
              {tabs.map(t => (
                <TabChip
                  key={t.id}
                  label={t.name}
                  count={t.count}
                  active={current === t.id}
                  isActiveDataset={t.id === activeDatasetId}
                  onClick={() => setSelected(t.id)}
                />
              ))}
              {unbound.length > 0 && (
                <TabChip
                  label="Без привязки"
                  count={unbound.length}
                  active={current === UNBOUND}
                  icon={<Unlink size={13} />}
                  onClick={() => setSelected(UNBOUND)}
                />
              )}
            </div>

            {/* Поиск */}
            <div className="relative max-w-sm">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Поиск по имени группы…"
                className="pl-9 h-9"
              />
            </div>

            {current === UNBOUND && (
              <p className="text-[12px] text-amber-600 dark:text-amber-400">
                Эти группы не привязаны к датасету (удалён или привязка снята). Откройте «Изменить»,
                чтобы перепривязать, либо удалите.
              </p>
            )}

            {/* Список групп текущей вкладки */}
            <div className="grid gap-3">
              {visibleGroups.length === 0 ? (
                <Card className="p-10 text-center border-dashed text-slate-500">
                  {q ? 'Ничего не найдено' : 'В этом датасете пока нет групп'}
                </Card>
              ) : (
                visibleGroups.map(group => (
                  <GroupCard
                    key={group.id}
                    group={group}
                    unbound={current === UNBOUND}
                    staleDatasetName={
                      current === UNBOUND && group.datasetId
                        ? datasets[group.datasetId]?.name
                        : undefined
                    }
                    onDelete={() => requestDelete(group.id)}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={isConfirming}
        onOpenChange={(open) => !open && cancelDelete()}
        title="Удалить группу?"
        description={
          affectedDashboards.length > 0 ? (
            <div className="space-y-2">
              <p>Это действие нельзя отменить.</p>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-700 dark:text-amber-300">
                <p className="font-semibold mb-1">
                  ⚠️ Группа используется в {affectedDashboards.length} дашборд
                  {affectedDashboards.length === 1 ? 'е' : 'ах'}:
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-xs">
                  {affectedDashboards.slice(0, 5).map(d => (
                    <li key={d.id}>{d.name}</li>
                  ))}
                  {affectedDashboards.length > 5 && (
                    <li className="text-slate-400">
                      ...и ещё {affectedDashboards.length - 5}
                    </li>
                  )}
                </ul>
                <p className="mt-2 text-xs opacity-80">
                  Привязки будут автоматически удалены из этих дашбордов.
                </p>
              </div>
            </div>
          ) : (
            'Это действие нельзя отменить'
          )
        }
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </>
  );
}

/** Чип-вкладка датасета (или «Без привязки»). */
function TabChip({
  label,
  count,
  active,
  isActiveDataset,
  icon,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  isActiveDataset?: boolean;
  icon?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={isActiveDataset ? 'Активный датасет' : undefined}
      className={cn(
        'inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm font-medium border transition-colors',
        active
          ? 'bg-emerald-600 text-white border-emerald-600'
          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
      )}
    >
      {icon ?? <Database size={13} />}
      <span className="max-w-[180px] truncate">{label}</span>
      {isActiveDataset && !active && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
      <span
        className={cn(
          'ml-0.5 px-1.5 rounded-full text-[11px] leading-4',
          active ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
        )}
      >
        {count}
      </span>
    </button>
  );
}

/** Карточка группы в списке. */
function GroupCard({
  group,
  unbound,
  staleDatasetName,
  onDelete,
}: {
  group: IndicatorGroup;
  unbound: boolean;
  staleDatasetName?: string;
  onDelete: () => void;
}) {
  return (
    <Card className="p-5 flex items-center justify-between hover:border-emerald-400/50 transition-colors group">
      <div className="flex items-center gap-5">
        <div
          className={cn(
            'p-3 rounded-xl',
            unbound
              ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
              : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
          )}
        >
          {unbound ? <Unlink size={24} /> : <Layers size={24} />}
        </div>
        <div>
          <h3 className="font-bold text-lg text-slate-900 dark:text-white">
            <Link
              href={`/groups/${group.id}`}
              className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
            >
              {group.name}
            </Link>
          </h3>
          <div className="flex flex-wrap gap-3 mt-1 text-sm text-slate-500 dark:text-slate-400">
            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-xs">
              Метрик: {group.metrics.length}
            </span>
            {group.fieldMappings.length > 0 && (
              <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-xs">
                Колонок Excel: {group.fieldMappings.length}
              </span>
            )}
            {unbound && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <Database size={11} />
                {staleDatasetName ? `Датасет удалён: ${staleDatasetName}` : 'Привязка снята'}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 opacity-70 group-hover:opacity-100 transition-opacity">
        <Button
          variant="outline"
          size="sm"
          className="border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
          asChild
        >
          <Link href={`/groups/${group.id}`}>
            <ArrowUpRight size={14} className="mr-2" /> Открыть
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/groups/${group.id}/edit`}>
            <Edit size={14} className="mr-2" /> Изменить
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-slate-400 hover:text-red-500"
          onClick={onDelete}
        >
          <Trash2 size={16} />
        </Button>
      </div>
    </Card>
  );
}
