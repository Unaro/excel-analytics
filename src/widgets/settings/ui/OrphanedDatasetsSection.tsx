'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Select, SelectOption } from '@/shared/ui/select';
import { Database, LayoutDashboard, Layers, Link2, CheckCircle2 } from 'lucide-react';
import { useDatasetStore } from '@/entities/dataset';
import { useDashboardStore } from '@/entities/dashboard';
import { useIndicatorGroupStore } from '@/entities/indicator-group';
import { useShallow } from 'zustand/react/shallow';
import { toast } from '@/shared/ui/toast';

interface OrphanItem {
  kind: 'dashboard' | 'group';
  id: string;
  name: string;
}

/**
 * Перепривязка «осиротевших» дашбордов и групп показателей.
 *
 * При удалении датасета дашборды и группы сохраняются намеренно, но их
 * `datasetId` начинает указывать на несуществующий источник. Здесь такие
 * элементы можно перепривязать к существующему датасету (меняется только
 * указатель; совместимость колонок — на усмотрение пользователя).
 */
export function OrphanedDatasetsSection() {
  const datasets = useDatasetStore(useShallow(s => s.datasets));
  const dashboards = useDashboardStore(useShallow(s => s.dashboards));
  const groups = useIndicatorGroupStore(useShallow(s => s.groups));
  const updateDashboard = useDashboardStore(s => s.updateDashboard);
  const updateGroup = useIndicatorGroupStore(s => s.updateGroup);

  // Датасеты-кандидаты для привязки (справочники исключаем).
  const availableDatasets = useMemo(
    () => Object.values(datasets).filter(ds => ds.role !== 'reference'),
    [datasets]
  );

  const existingIds = useMemo(() => new Set(Object.keys(datasets)), [datasets]);

  const orphans = useMemo<OrphanItem[]>(() => {
    const list: OrphanItem[] = [];
    for (const d of dashboards) {
      if (!d.datasetId || !existingIds.has(d.datasetId)) {
        list.push({ kind: 'dashboard', id: d.id, name: d.name });
      }
    }
    for (const g of groups) {
      if (!g.datasetId || !existingIds.has(g.datasetId)) {
        list.push({ kind: 'group', id: g.id, name: g.name });
      }
    }
    return list;
  }, [dashboards, groups, existingIds]);

  // Выбранный целевой датасет для каждого сироты (id → datasetId).
  const [targets, setTargets] = useState<Record<string, string>>({});

  const rebind = (item: OrphanItem) => {
    const targetId = targets[item.id] ?? availableDatasets[0]?.id;
    if (!targetId) return;
    if (item.kind === 'dashboard') updateDashboard(item.id, { datasetId: targetId });
    else updateGroup(item.id, { datasetId: targetId });
    toast.success(
      `${item.kind === 'dashboard' ? 'Дашборд' : 'Группа'} «${item.name}» ` +
        `привязан${item.kind === 'dashboard' ? '' : 'а'} к «${datasets[targetId]?.name ?? targetId}»`
    );
  };

  // Нет сирот — спокойное «всё привязано».
  if (orphans.length === 0) {
    return (
      <Card className="p-6 border-l-4 border-l-emerald-500">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-lg">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">
              Привязка источников
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Все дашборды и группы привязаны к существующим датасетам.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 border-l-4 border-l-amber-500">
      <div className="flex items-start gap-4">
        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-lg">
          <Database size={20} />
        </div>
        <div className="flex-1 space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Перепривязка источников
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Эти элементы ссылаются на удалённый датасет. Выберите существующий
              источник и перепривяжите. Колонки и метрики совпадут, если структура
              нового датасета близка к исходному.
            </p>
          </div>

          {availableDatasets.length === 0 ? (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Нет доступных датасетов для привязки — сначала загрузите данные на
              странице «Данные и Колонки».
            </p>
          ) : (
            <div className="space-y-2">
              {orphans.map(item => {
                const Icon = item.kind === 'dashboard' ? LayoutDashboard : Layers;
                const selected = targets[item.id] ?? availableDatasets[0].id;
                return (
                  <div
                    key={`${item.kind}-${item.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                  >
                    <Icon size={16} className="text-slate-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                        {item.name}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {item.kind === 'dashboard' ? 'Дашборд' : 'Группа показателей'}
                      </div>
                    </div>
                    <Select
                      className="h-9 w-56 shrink-0"
                      value={selected}
                      onChange={e =>
                        setTargets(prev => ({ ...prev, [item.id]: e.target.value }))
                      }
                    >
                      {availableDatasets.map(ds => (
                        <SelectOption key={ds.id} value={ds.id}>{ds.name}</SelectOption>
                      ))}
                    </Select>
                    <Button size="sm" onClick={() => rebind(item)} className="gap-1.5 shrink-0">
                      <Link2 size={14} /> Привязать
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
