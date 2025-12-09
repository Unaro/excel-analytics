'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboardBuilder } from '@/lib/hooks/use-dashboard-builder';
import { useMetricTemplateStore } from '@/lib/stores/metric-template-store';
import { IndicatorGroupInDashboard, VirtualMetric, IndicatorGroup } from '@/types';
import { Plus, Save, Trash2, LayoutGrid, Columns } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function DashboardBuilder({ dashboardId }: { dashboardId?: string }) {
  const router = useRouter();
  const {
    name, setName, description, setDescription,
    virtualMetrics, addVirtualMetric, removeVirtualMetric,
    dashboardGroups, addGroupToDashboard, removeGroupFromDashboard, updateBinding,
    saveDashboard, availableGroups
  } = useDashboardBuilder(dashboardId);

  const [newVmName, setNewVmName] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');

  const handleSave = () => {
    try {
      const id = saveDashboard();
      toast.success('Дашборд сохранен');
      router.push(`/dashboards/${id}`);
    } catch (e) {
      toast.error('Ошибка сохранения');
    }
  };

  // Базовые стили для селекта (чтобы совпадал с Input)
  const selectClass = "flex h-10 w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus:ring-indigo-500";

  return (
    <div className="max-w-7xl mx-auto p-8 space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            {dashboardId ? 'Настройка дашборда' : 'Новый дашборд'}
          </h1>
        </div>
        <Button onClick={handleSave}>
          <Save size={16} className="mr-2" /> Сохранить
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ЛЕВАЯ КОЛОНКА: Мета + Колонки */}
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
                onKeyDown={e => { if(e.key === 'Enter' && newVmName) { addVirtualMetric(newVmName); setNewVmName(''); }}}
              />
              <Button size="icon" onClick={() => { if(newVmName) { addVirtualMetric(newVmName); setNewVmName(''); }}}>
                <Plus size={18} />
              </Button>
            </div>

            <div className="space-y-2">
              {virtualMetrics.map(vm => (
                <div key={vm.id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                  <span className="font-medium text-sm">{vm.name}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-red-500" onClick={() => removeVirtualMetric(vm.id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
              {virtualMetrics.length === 0 && <div className="text-xs text-slate-400 text-center py-4">Нет колонок</div>}
            </div>
          </Card>
        </div>

        {/* ПРАВАЯ КОЛОНКА: Матрица */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-6 min-h-[500px] flex flex-col">
            <div className="flex justify-between items-center mb-6">
               <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                 <LayoutGrid size={18} className="text-emerald-500" />
                 <h2>Конфигурация строк</h2>
               </div>
               <div className="flex gap-2">
                 <select 
                   className={cn(selectClass, "w-[200px]")}
                   value={selectedGroupId}
                   onChange={e => setSelectedGroupId(e.target.value)}
                 >
                   <option value="">+ Выбрать группу</option>
                   {availableGroups.filter(g => !dashboardGroups.some(dg => dg.groupId === g.id)).map(g => (
                       <option key={g.id} value={g.id}>{g.name}</option>
                   ))}
                 </select>
                 <Button onClick={() => { if (selectedGroupId) { addGroupToDashboard(selectedGroupId); setSelectedGroupId(''); }}}>
                   Добавить
                 </Button>
               </div>
            </div>

            <div className="border rounded-xl overflow-x-auto dark:border-slate-800 flex-1">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-800">
                <thead className="bg-gray-50 dark:bg-slate-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase w-1/4 sticky left-0 bg-gray-50 dark:bg-slate-900 z-10 border-r dark:border-slate-800">
                      Группа
                    </th>
                    {virtualMetrics.map(vm => (
                      <th key={vm.id} className="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase min-w-[220px]">
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

function MappingRow({ groupConfig, virtualMetrics, allGroups, onUpdateBinding, onRemove }: {
  // Типизируем пропсы
  groupConfig: IndicatorGroupInDashboard;
  virtualMetrics: VirtualMetric[];
  allGroups: IndicatorGroup[];
  onUpdateBinding: (gid: string, vid: string, mid: string) => void;
  onRemove: () => void;
}) {
  const fullGroup = allGroups.find((g) => g.id === groupConfig.groupId);
  const templates = useMetricTemplateStore(s => s.templates);
  
  if (!fullGroup) return null;

  return (
    <tr className="group hover:bg-slate-50 dark:hover:bg-slate-900/50">
      <td className="px-4 py-3 font-medium text-sm sticky left-0 bg-white dark:bg-slate-950 group-hover:bg-slate-50 dark:group-hover:bg-slate-900/50 border-r dark:border-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
        {fullGroup.name}
      </td>
      {virtualMetrics.map((vm: VirtualMetric) => {
        const binding = groupConfig.virtualMetricBindings?.find((b) => b.virtualMetricId === vm.id);
        return (
          <td key={vm.id} className="px-4 py-2">
            <select
              className={cn(
                "w-full h-8 rounded border px-2 text-xs focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900",
                binding 
                  ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300" 
                  : "border-gray-200 text-slate-400 dark:border-slate-800"
              )}
              value={binding?.metricId || ''}
              onChange={(e) => onUpdateBinding(groupConfig.groupId, vm.id, e.target.value)}
            >
              <option value="">—</option>
              {fullGroup.metrics.map((metric) => {
                const tpl = templates.find(t => t.id === metric.templateId);
                return <option key={metric.id} value={metric.id}>{tpl?.name || 'Metric'}</option>;
              })}
            </select>
          </td>
        );
      })}
      <td className="px-2 text-center">
        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-500" onClick={onRemove}>
          <Trash2 size={14} />
        </Button>
      </td>
    </tr>
  );
}