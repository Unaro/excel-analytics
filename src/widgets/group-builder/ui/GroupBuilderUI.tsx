'use client';
import { useState } from 'react';
import { useMetricTemplateStore } from '@/entities/metric';
import { Save, Trash2, FunctionSquare, Calculator, Filter, Search, Hash, GripVertical } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Card } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Select, SelectOption, SelectGroup } from '@/shared/ui/select';
import { TemplateForm } from '@/features/CreateMetricTemplate';
import { SearchableSelect } from '@/shared/ui/searchable-select';
import { cn } from '@/shared/lib/utils';
import { useDatasetStore } from '@/entities/dataset';
import type { useGroupBuilder, FormMetricState } from '@/features/group-builder/model/use-group-builder';
import { DragDropList, RenderItemProps } from '@/shared/ui/drag-drop-list';
import { Database } from 'lucide-react';

interface GroupBuilderUIProps {
  builder: ReturnType<typeof useGroupBuilder>;
  mode: 'create' | 'edit';
  onSave: () => void;
}

const stopDragEvents = {
  onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
  onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
  onTouchStart: (e: React.TouchEvent) => e.stopPropagation(),
};

export function GroupBuilderUI({ builder, mode, onSave }: GroupBuilderUIProps) {
  const {
    name, setName, selectedMetrics,
    addMetricToGroup, updateVariableType, updateBindingValue,
    removeMetric, reorderMetrics,
    availableTemplates, availableColumns,
    columnSearchQuery, setColumnSearchQuery, updateMetricUnit, updateMetricCustomName
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

  const renderMetric = ({
    item, index, isDragging, listeners, attributes,
  }: RenderItemProps<FormMetricState>) => {
    const template = templates.find(t => t.id === item.templateId);
    if (!template) return null;

    return (
      <div className={cn(
        'bg-white dark:bg-slate-950 rounded-xl p-5 border relative group shadow-sm transition-all',
        isDragging
          ? 'border-indigo-400 dark:border-indigo-600 ring-2 ring-indigo-200 dark:ring-indigo-800 shadow-xl scale-[1.01]'
          : 'border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700'
      )}>
        {/* Заголовок: DRAG-ЗОНА */}
        <div
          {...attributes}
          {...listeners}
          className={cn(
            'flex items-center gap-3 mb-4 border-b border-slate-100 dark:border-slate-800 pb-3',
            'cursor-grab active:cursor-grabbing select-none',
            isDragging && 'cursor-grabbing'
          )}
        >
          <div className="flex items-center gap-2 shrink-0">
            <div className={cn(
              'text-slate-300 dark:text-slate-600 transition-colors',
              'group-hover:text-indigo-400',
              isDragging && 'text-indigo-500'
            )}>
              <GripVertical size={16} />
            </div>
            <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-mono font-bold text-slate-500">
              {index + 1}
            </div>
          </div>

          <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-lg min-w-0">
            {template.type === 'aggregate' ? (
              <FunctionSquare size={18} className="text-blue-500 shrink-0" />
            ) : (
              <Calculator size={18} className="text-purple-500 shrink-0" />
            )}
            <input
              type="text"
              value={item.customName || ''}
              onChange={(e) => updateMetricCustomName(item.tempId, e.target.value)}
              placeholder={template.name}
              className="bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-indigo-500 focus:outline-none px-1 -mx-1 transition-colors max-w-[200px] text-inherit placeholder:text-slate-400"
              {...stopDragEvents}
            />
          </div>

          <div className="ml-1">
            <Input
              placeholder="ед. (чел.)"
              value={item.unit}
              onChange={(e) => updateMetricUnit(item.tempId, e.target.value)}
              className="h-7 w-24 text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
              {...stopDragEvents}
            />
          </div>

          {template.type === 'calculated' && (
            <Badge variant="outline" className="font-mono text-[10px] opacity-70 ml-2 shrink-0">
              {template.formula}
            </Badge>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0"
            onClick={(e) => { e.stopPropagation(); removeMetric(item.tempId); }}
            {...stopDragEvents}
          >
            <Trash2 size={16} />
          </Button>
        </div>

        {/* Привязки переменных */}
        <div className="space-y-4 pl-0 sm:pl-9">
          {item.requiredVariables.map(variable => (
            <div key={variable} className="flex flex-col sm:flex-row sm:items-center gap-3 text-sm">
              <div className="w-full sm:w-10 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-900 border dark:border-slate-800 rounded font-mono font-bold text-slate-600 dark:text-slate-400 shrink-0">
                {variable}
              </div>

              <div className="flex p-1 bg-slate-100 dark:bg-slate-900 border dark:border-slate-800 rounded-lg shrink-0 h-9 self-start sm:self-auto">
                <button
                  onClick={() => updateVariableType(item.tempId, variable, 'field')}
                  className={cn(
                    'px-3 text-xs font-medium rounded transition-all flex items-center gap-1',
                    item.variableTypes[variable] === 'field'
                      ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                  )}
                >
                  <Hash size={12} /> Колонка
                </button>
                <div className="w-px bg-slate-200 dark:bg-slate-800 mx-1 my-1" />
                <button
                  onClick={() => updateVariableType(item.tempId, variable, 'metric')}
                  disabled={index === 0}
                  className={cn(
                    'px-3 text-xs font-medium rounded transition-all flex items-center gap-1',
                    item.variableTypes[variable] === 'metric'
                      ? 'bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400',
                    index === 0 && 'opacity-50 cursor-not-allowed'
                  )}
                  title={index === 0 ? 'Нельзя сослаться на метрику выше в списке' : ''}
                >
                  <Calculator size={12} /> Метрика
                </button>
              </div>

              <div className="flex-1 min-w-0">
                {item.variableTypes[variable] === 'field' ? (
                  <SearchableSelect
                    value={item.bindings[variable] || ''}
                    onChange={(val) => updateBindingValue(item.tempId, variable, val)}
                    options={availableColumns
                      .filter(c => c.classification === 'numeric')
                      .map(col => ({ value: col.columnName, label: col.displayName, subLabel: col.alias }))}
                    placeholder={columnSearchQuery ? `Выберите из найденных (${availableColumns.length})...` : 'Выберите колонку Excel...'}
                    className="w-full"
                  />
                ) : (
                  <Select
                    className="border-purple-200 dark:border-purple-900/50 focus:ring-purple-500"
                    value={item.bindings[variable] || ''}
                    onChange={(e) => updateBindingValue(item.tempId, variable, e.target.value)}
                  >
                    <SelectOption value="">Выберите метрику выше...</SelectOption>
                    {selectedMetrics.slice(0, index).map(prev => {
                      const t = templates.find(x => x.id === prev.templateId);
                      return (
                        <SelectOption key={prev.tempId} value={prev.tempId}>
                          {selectedMetrics.find(x => x.tempId === prev.tempId)?.customName || t?.name}
                        </SelectOption>
                      );
                    })}
                  </Select>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

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
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Например: Дошкольное образование"
              className="text-lg h-11"
            />
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
            <label className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2 text-slate-500">
              <Filter size={12} />
              Контекст данных
            </label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={columnSearchQuery}
                onChange={e => setColumnSearchQuery(e.target.value)}
                placeholder="Например: ДОО"
                className="pl-9 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
              />
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
              <Select
                className="cursor-pointer"
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'CREATE_NEW') {
                    setIsDialogOpen(true);
                  } else if (val) {
                    addMetricToGroup(val);
                  }
                  e.target.value = '';
                }}
              >
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
                items={selectedMetrics}
                onReorder={reorderMetrics}
                renderItem={renderMetric}
                className="space-y-4"
                dragDelay={0}
              />
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
            onSuccess={(newTemplateId) => {
              setIsDialogOpen(false);
              addMetricToGroup(newTemplateId);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}