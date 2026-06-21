'use client';

import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Plus, Search, Layers } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { GroupAdderProps } from '../model/types';

/**
 * Добавление групп на дашборд — список с кликом (как селектор метрик в
 * редакторе группы показателей), а не выпадашка + кнопка. Клик по группе
 * добавляет её сразу; добавленная исчезает из списка, поповер остаётся
 * открытым для добавления нескольких.
 */
export function GroupAdder({ availableGroups, dashboardGroups, onAdd }: GroupAdderProps) {
  const [query, setQuery] = useState('');

  const addable = availableGroups.filter(
    g => !dashboardGroups.some(dg => dg.groupId === g.id)
  );
  const q = query.trim().toLowerCase();
  const filtered = q ? addable.filter(g => g.name.toLowerCase().includes(q)) : addable;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button className="gap-1.5">
          <Plus size={16} /> Добавить группу
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-72 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-2"
        >
          <div className="relative mb-2">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Поиск группы…"
              className="w-full h-8 pl-8 pr-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="max-h-64 overflow-y-auto space-y-0.5">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-sm text-center text-slate-400">
                {addable.length === 0 ? 'Все группы уже добавлены' : 'Ничего не найдено'}
              </p>
            ) : (
              filtered.map(g => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => onAdd(g.id)}
                  title={`Добавить «${g.name}»`}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm hover:bg-indigo-50 dark:hover:bg-slate-800 group transition-colors"
                >
                  <Layers size={14} className="text-slate-400 group-hover:text-indigo-500 shrink-0" />
                  <span className="truncate text-slate-700 dark:text-slate-200">{g.name}</span>
                  <Plus size={14} className="ml-auto text-slate-300 group-hover:text-indigo-500 shrink-0" />
                </button>
              ))
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
