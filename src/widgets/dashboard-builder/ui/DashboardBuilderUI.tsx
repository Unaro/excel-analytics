'use client';

import { useState } from 'react';
import { Plus, Save, Trash2, LayoutGrid, Columns, GripVertical } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Card } from '@/shared/ui/card';
import { cn } from '@/shared/lib/utils';
import type { VirtualMetric } from '@/shared/lib/validators';
import { DragDropList, RenderItemProps } from '@/shared/ui/drag-drop-list';
import { GroupAdder } from './GroupAdder';
import { MappingRow } from './MappingRow';
import { useDashboardBuilder } from '../model/use-dashboard-builder';

interface DashboardBuilderUIProps {
  builder: ReturnType<typeof useDashboardBuilder>;
  mode: 'create' | 'edit';
  onSave: () => void;
}

export function DashboardBuilderUI({ builder, mode, onSave }: DashboardBuilderUIProps) {
  const {
    name, setName, description, setDescription,
    virtualMetrics, addVirtualMetric, removeVirtualMetric, reorderVirtualMetrics,
    dashboardGroups, addGroupToDashboard, removeGroupFromDashboard, updateBinding,
    availableGroups
  } = builder;

  const [newVmName, setNewVmName] = useState('');

  const renderVirtualMetric = ({
    item: vm, isDragging, listeners, attributes,
  }: RenderItemProps<VirtualMetric>) => (
    <div
      {...attributes}
      {...listeners}
      className={cn(
        'flex justify-between items-center bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg border',
        'cursor-grab active:cursor-grabbing group transition-all',
        isDragging
          ? 'ring-2 ring-indigo-500 shadow-lg cursor-grabbing border-indigo-300 dark:border-indigo-700'
          : 'border-slate-100 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md'
      )}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className={cn(
          'text-slate-400 transition-colors shrink-0',
          'group-hover:text-indigo-500',
          isDragging && 'text-indigo-600'
        )}>
          <GripVertical size={14} />
        </div>
        <span className="font-medium text-sm truncate">{vm.name}</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'h-6 w-6 text-slate-400 hover:text-red-500 shrink-0 transition-opacity',
          'opacity-0 group-hover:opacity-100 focus:opacity-100'
        )}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); removeVirtualMetric(vm.id); }}
        aria-label={`Удалить колонку "${vm.name}"`}
      >
        <Trash2 size={14} />
      </Button>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-8 space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            {mode === 'edit' ? 'Настройка дашборда' : 'Новый дашборд'}
          </h1>
        </div>
        <Button onClick={onSave}>
          <Save size={16} className="mr-2" /> Сохранить
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-6 lg:col-span-1">
          <Card className="p-5 space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Название</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Например: Соц. объекты" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Описание</label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Краткое описание" />
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
              <Columns size={18} className="text-indigo-500" />
              <h2>Колонки таблицы</h2>
            </div>
            <div className="flex gap-2">
              <Input
                value={newVmName}
                onChange={e => setNewVmName(e.target.value)}
                placeholder="Новая колонка"
                onKeyDown={e => { if (e.key === 'Enter' && newVmName) { addVirtualMetric(newVmName); setNewVmName(''); } }}
              />
              <Button size="icon" onClick={() => { if (newVmName) { addVirtualMetric(newVmName); setNewVmName(''); } }}>
                <Plus size={18} />
              </Button>
            </div>
            {virtualMetrics.length === 0 ? (
              <div className="text-xs text-slate-400 text-center py-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                Нет колонок
              </div>
            ) : (
              <>
                <DragDropList<VirtualMetric>
                  items={virtualMetrics}
                  onReorder={reorderVirtualMetrics}
                  renderItem={renderVirtualMetric}
                  className="space-y-2"
                  dragDelay={0}
                />
                <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <GripVertical size={10} />
                  <span>Перетащите для изменения порядка колонок в таблице</span>
                </div>
              </>
            )}
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Card className="p-6 min-h-125 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                <LayoutGrid size={18} className="text-emerald-500" />
                <h2>Конфигурация строк</h2>
              </div>
              <GroupAdder
                availableGroups={availableGroups}
                dashboardGroups={dashboardGroups}
                onAdd={addGroupToDashboard}
              />
            </div>
            <div className="border rounded-xl overflow-x-auto dark:border-slate-800 flex-1">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800">
                <thead className="bg-gray-50 dark:bg-slate-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase w-1/4 sticky left-0 bg-gray-50 dark:bg-slate-900 z-10 border-r dark:border-slate-800">
                      Группа
                    </th>
                    {virtualMetrics.map(vm => (
                      <th key={vm.id} className="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase min-w-55">
                        {vm.name}
                      </th>
                    ))}
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-800 bg-white dark:bg-slate-950">
                  {dashboardGroups.map(groupConf => (
                    <MappingRow
                      key={groupConf.groupId}
                      groupConfig={groupConf}
                      virtualMetrics={virtualMetrics}
                      allGroups={availableGroups}
                      onUpdateBinding={updateBinding}
                      onRemove={() => removeGroupFromDashboard(groupConf.groupId)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}