'use client';

import { useState } from 'react';
import { useMetricTemplateStore } from '@/entities/metric';
import { Save, Filter, Search, Database, GripVertical, Calculator } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Card } from '@/shared/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Select, SelectOption, SelectGroup } from '@/shared/ui/select';
import { TemplateForm } from '@/features/metric-template';
import { useDatasetStore } from '@/entities/dataset';
import { DragDropList, RenderItemProps } from '@/shared/ui/drag-drop-list';
import { MetricRow } from './MetricRow';
import type { GroupBuilderUIProps, FormMetricState } from '../model/types';

export function GroupBuilderUI({ builder, mode, onSave }: GroupBuilderUIProps) {
  const {
    name, setName, selectedMetrics, addMetricToGroup,
    updateVariableType, updateBindingValue, removeMetric, reorderMetrics,
    availableTemplates, availableColumns, columnSearchQuery,
    setColumnSearchQuery, updateMetricUnit, updateMetricCustomName,
  } = builder;

  const hasDataset = !!useDatasetStore(s => s.activeDatasetId);
  const templates = useMetricTemplateStore(s => s.templates);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  if (!hasDataset) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center space-y-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
        <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
          <Database size={28} />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Датасет не выбран</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Для создания или редактирования группы метрик необходимо сначала выбрать активный датасет.
          </p>
        </div>
      </div>
    );
  }

  const renderMetric = ({ item, index, isDragging, listeners, attributes }: RenderItemProps<FormMetricState>) => (
    <MetricRow
      item={item} index={index} isDragging={isDragging}
      listeners={listeners} attributes={attributes}
      templates={templates} availableColumns={availableColumns}
      selectedMetrics={selectedMetrics}
      onUpdateMetricCustomName={updateMetricCustomName}
      onUpdateMetricUnit={updateMetricUnit}
      onUpdateVariableType={updateVariableType}
      onUpdateBindingValue={updateBindingValue}
      onRemoveMetric={removeMetric}
    />
  );

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          {mode === 'edit' ? 'Редактирование группы' : 'Новая группа'}
        </h2>
        <Button onClick={onSave} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Save size={18} className="mr-2" /> Сохранить
        </Button>
      </div>

      <Card className="p-6 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b dark:border-slate-800">
          <div>
            <label className="text-sm font-medium mb-2 block text-slate-700 dark:text-slate-300">
              Название группы
            </label>
            <Input value={name} onChange={e => setName(e.target.value)}
              placeholder="Например: Дошкольное образование" className="text-lg h-11" />
          </div>
          <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
            <label className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2 text-slate-500">
              <Filter size={12} /> Контекст данных
            </label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input value={columnSearchQuery} onChange={e => setColumnSearchQuery(e.target.value)}
                placeholder="Например: ДОО"
                className="pl-9 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" />
              {columnSearchQuery && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-emerald-600 font-medium bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded">
                  {availableColumns.length} шт.
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
            <div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">Состав метрик</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Определите, как рассчитываются показатели внутри этой группы.
                {selectedMetrics.length > 1 && (
                  <span className="block mt-1 text-xs text-indigo-500 dark:text-indigo-400">
                    ↕ Перетащите для изменения порядка вычислений
                  </span>
                )}
              </p>
            </div>
            <div className="w-full sm:w-64">
              <Select className="cursor-pointer"
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'CREATE_NEW') { setIsDialogOpen(true); }
                  else if (val) { addMetricToGroup(val); }
                  e.target.value = '';
                }}>
                <SelectOption value="">+ Добавить метрику</SelectOption>
                <SelectOption value="CREATE_NEW" className="bg-indigo-50 dark:bg-slate-800 text-indigo-600 font-semibold">
                  ✨ Создать новый шаблон...
                </SelectOption>
                <SelectGroup label="Доступные шаблоны">
                  {availableTemplates.map(t => (
                    <SelectOption key={t.id} value={t.id}>{t.name}</SelectOption>
                  ))}
                </SelectGroup>
              </Select>
            </div>
          </div>

          {selectedMetrics.length === 0 && (
            <div className="text-center py-16 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/20">
              <div className="mx-auto w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3 text-slate-400">
                <Calculator size={24} />
              </div>
              <p className="text-slate-500 font-medium">Список пуст</p>
            </div>
          )}

          {selectedMetrics.length > 0 && (
            <>
              <DragDropList<FormMetricState>
                items={selectedMetrics} onReorder={reorderMetrics}
                renderItem={renderMetric} className="space-y-4" dragDelay={0} />
              <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <GripVertical size={10} />
                <span>Порядок влияет на вычисление calculated-метрик</span>
              </div>
            </>
          )}
        </div>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Создание шаблона метрики</DialogTitle>
          </DialogHeader>
          <TemplateForm
            onCancel={() => setIsDialogOpen(false)}
            onSuccess={(newTemplateId) => { setIsDialogOpen(false); addMetricToGroup(newTemplateId); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}