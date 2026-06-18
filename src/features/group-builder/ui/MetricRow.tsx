'use client';

import { FunctionSquare, Calculator, Trash2, GripVertical, Hash, AlertTriangle } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Badge } from '@/shared/ui/badge';
import { Select, SelectOption } from '@/shared/ui/select';
import { SearchableSelect } from '@/shared/ui/searchable-select';
import { cn } from '@/shared/lib/utils';
import type { MetricRowProps } from '../model/types';

const stopDragEvents = {
  onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
  onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
  onTouchStart: (e: React.TouchEvent) => e.stopPropagation(),
};

/**
 * Приватный компонент строки метрики в редакторе группы.
 *
 * Вынесен из GroupBuilderUI для:
 *  - Улучшения читаемости основного компонента
 *  - Возможности тестирования изолированно
 *  - Соблюдения принципа Single Responsibility
 */
export function MetricRow({
  item,
  index,
  isDragging,
  listeners,
  attributes,
  templates,
  availableColumns,
  selectedMetrics,
  onUpdateMetricCustomName,
  onUpdateMetricUnit,
  onUpdateVariableType,
  onUpdateBindingValue,
  onRemoveMetric,
}: MetricRowProps) {
  const template = templates.find(t => t.id === item.templateId);

  // Шаблон метрики удалён: раньше строка не рендерилась вовсе (return null),
  // из-за чего осиротевший показатель оставался в группе без возможности
  // удаления. Показываем деградированную строку с кнопкой удаления —
  // в расчётах такой показатель не участвует (компилятор его пропускает).
  if (!template) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl p-4 border border-amber-300 dark:border-amber-800 flex items-center gap-3">
        <AlertTriangle size={18} className="text-amber-500 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-slate-900 dark:text-white text-sm truncate">
            {item.customName || 'Показатель без названия'}
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
            Шаблон формулы удалён — показатель не участвует в расчётах. Удалите его из группы.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onRemoveMetric(item.tempId);
          }}
          {...stopDragEvents}
        >
          <Trash2 size={16} />
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'bg-white dark:bg-slate-950 rounded-xl p-5 border relative group shadow-sm transition-all',
        isDragging
          ? 'border-indigo-400 dark:border-indigo-600 ring-2 ring-indigo-200 dark:ring-indigo-800 shadow-xl scale-[1.01]'
          : 'border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700'
      )}
    >
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
          <div
            className={cn(
              'text-slate-300 dark:text-slate-600 transition-colors',
              'group-hover:text-indigo-400',
              isDragging && 'text-indigo-500'
            )}
          >
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
            onChange={(e) => onUpdateMetricCustomName(item.tempId, e.target.value)}
            placeholder={template.name}
            className="bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-indigo-500 focus:outline-none px-1 -mx-1 transition-colors max-w-[200px] text-inherit placeholder:text-slate-400"
            {...stopDragEvents}
          />
        </div>

        <div className="ml-1">
          {/* Пусто — наследуется единица шаблона (показана в placeholder).
              Значение здесь переопределяет шаблонное только для этой группы. */}
          <Input
            placeholder={template.unit ? `${template.unit} (из шаблона)` : 'ед. (чел.)'}
            value={item.unit}
            onChange={(e) => onUpdateMetricUnit(item.tempId, e.target.value)}
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
          onClick={(e) => {
            e.stopPropagation();
            onRemoveMetric(item.tempId);
          }}
          {...stopDragEvents}
        >
          <Trash2 size={16} />
        </Button>
      </div>

      {/* Привязки переменных */}
      <div className="space-y-4 pl-0 sm:pl-9">
        {item.requiredVariables.map((variable) => (
          <div key={variable} className="flex flex-col sm:flex-row sm:items-center gap-3 text-sm">
            <div className="w-full sm:w-10 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-900 border dark:border-slate-800 rounded font-mono font-bold text-slate-600 dark:text-slate-400 shrink-0">
              {variable}
            </div>

            <div className="flex p-1 bg-slate-100 dark:bg-slate-900 border dark:border-slate-800 rounded-lg shrink-0 h-9 self-start sm:self-auto">
              <button
                onClick={() => onUpdateVariableType(item.tempId, variable, 'field')}
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
                onClick={() => onUpdateVariableType(item.tempId, variable, 'metric')}
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
                  onChange={(val) => onUpdateBindingValue(item.tempId, variable, val)}
                  options={availableColumns
                    .filter(c => c.classification === 'numeric')
                    .map(col => ({
                      value: col.columnName,
                      label: col.displayName,
                      subLabel: col.alias,
                    }))}
                  placeholder="Выберите колонку Excel..."
                  className="w-full"
                />
              ) : (
                <Select
                  className="border-purple-200 dark:border-purple-900/50 focus:ring-purple-500"
                  value={item.bindings[variable] || ''}
                  onChange={(e) => onUpdateBindingValue(item.tempId, variable, e.target.value)}
                >
                  <SelectOption value="">Выберите метрику выше...</SelectOption>
                  {selectedMetrics.slice(0, index).map((prev) => {
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
}