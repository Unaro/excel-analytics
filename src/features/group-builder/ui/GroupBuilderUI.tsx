'use client';

import { useState } from 'react';
import { useMetricTemplateStore } from '@/entities/metric';
import { Save, Filter, Search, Database, GripVertical, Calculator, Plus, Sparkles } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Card } from '@/shared/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { TemplateForm } from '@/features/metric-template';
import { useDatasetStore } from '@/entities/dataset';
import { DragDropList, RenderItemProps } from '@/shared/ui/drag-drop-list';
import { MetricRow } from './MetricRow';
import type { GroupBuilderUIProps, FormMetricState } from '../model/types';

/** Цвет точки-индикатора по классификации колонки. */
const CLASSIFICATION_DOT: Record<string, string> = {
  numeric: 'bg-blue-400',
  date: 'bg-purple-400',
  categorical: 'bg-emerald-400',
  ignore: 'bg-slate-300 dark:bg-slate-600',
};
const CLASSIFICATION_LABEL: Record<string, string> = {
  numeric: 'Число',
  date: 'Дата',
  categorical: 'Категория',
  ignore: 'Игнорируется',
};

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

        {/* Доступные поля под заданный контекст — полоса на всю ширину.
            Показываем, только когда задан контекст данных. */}
        {columnSearchQuery.trim() && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 p-4 -mt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <Filter size={12} /> Доступные поля
              </h4>
              <span className="text-xs text-slate-400">{availableColumns.length} шт.</span>
            </div>
            {availableColumns.length === 0 ? (
              <p className="text-sm text-slate-400">Нет колонок под этот контекст — измените запрос.</p>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-44 overflow-y-auto">
                {availableColumns.map(c => (
                  <span key={c.columnName}
                    title={`${c.columnName} · ${CLASSIFICATION_LABEL[c.classification] ?? c.classification}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${CLASSIFICATION_DOT[c.classification] ?? 'bg-slate-300'}`} />
                    {c.displayName}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">Состав метрик</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Добавляйте показатели из списка шаблонов справа.
                {selectedMetrics.length > 1 && (
                  <span className="block mt-1 text-xs text-indigo-500 dark:text-indigo-400">
                    ↕ Перетащите для изменения порядка вычислений
                  </span>
                )}
              </p>
            </div>
            {/* На месте прежнего селектора — кнопка создания нового шаблона. */}
            <Button variant="outline" onClick={() => setIsDialogOpen(true)}
              className="shrink-0 border-indigo-200 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20">
              <Sparkles size={16} className="mr-2" /> Создать новый шаблон
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Левая колонка — состав группы (выбранные метрики). */}
            <div className="lg:col-span-2 space-y-4">
              {selectedMetrics.length === 0 && (
                <div className="text-center py-16 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/20">
                  <div className="mx-auto w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3 text-slate-400">
                    <Calculator size={24} />
                  </div>
                  <p className="text-slate-500 font-medium">Список пуст</p>
                  <p className="text-sm text-slate-400 mt-1">Выберите шаблон в списке справа →</p>
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

            {/* Правая колонка — список шаблонов: клик добавляет метрику в группу. */}
            <div className="lg:col-span-1">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Шаблоны</h4>
                  <span className="text-xs text-slate-400">{availableTemplates.length} шт.</span>
                </div>
                {availableTemplates.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-center text-slate-400">
                    Шаблонов пока нет. Создайте первый кнопкой выше.
                  </p>
                ) : (
                  <div className="p-2 max-h-[460px] overflow-y-auto space-y-1">
                    {availableTemplates.map(t => (
                      <button key={t.id} type="button" onClick={() => addMetricToGroup(t.id)}
                        title={`Добавить «${t.name}» в группу`}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left hover:bg-white dark:hover:bg-slate-800 transition-colors group">
                        <Plus size={14} className="shrink-0 text-slate-400 group-hover:text-indigo-500" />
                        <span className="text-sm text-slate-700 dark:text-slate-200 truncate">{t.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
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