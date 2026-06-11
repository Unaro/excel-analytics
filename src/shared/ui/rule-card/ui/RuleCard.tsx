'use client';

import { memo } from 'react';
import { Copy, Trash2 } from 'lucide-react';
import { COLOR_STYLES, METRIC_COLOR_HEX, MetricColor } from '@/shared/lib/utils/metric-colors';
import { cn } from '@/shared/lib/utils';
import { ConditionOperator, RuleCardProps } from '../types';


export const stopDragEvents = {
  onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
  onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
  onTouchStart: (e: React.TouchEvent) => e.stopPropagation(),
};

export const RuleCard = memo(function RuleCard({
  item: rule,
  index,
  isDragging,
  listeners,
  attributes,
  onUpdate,
  onRemove,
  onDuplicate,
  parseNumber,
}: RuleCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg border',
        'group/rule transition-all',
        isDragging
          ? 'border-indigo-400 dark:border-indigo-600 ring-2 ring-indigo-200 dark:ring-indigo-800 shadow-xl cursor-grabbing'
          : 'border-slate-100 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700'
      )}
    >
      {/* ─── Верхняя строка: DRAG-ЗОНА ─── */}
      <div
        {...attributes}
        {...listeners}
        className={cn(
          'flex items-center gap-2 w-full',
          'cursor-grab active:cursor-grabbing select-none',
          isDragging && 'cursor-grabbing'
        )}
      >
        {/* Grip + приоритет */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div
            className={cn(
              'text-slate-300 dark:text-slate-600 transition-colors',
              'group-hover/rule:text-indigo-500',
              isDragging && 'text-indigo-500'
            )}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="9" cy="6" r="1.5" />
              <circle cx="15" cy="6" r="1.5" />
              <circle cx="9" cy="12" r="1.5" />
              <circle cx="15" cy="12" r="1.5" />
              <circle cx="9" cy="18" r="1.5" />
              <circle cx="15" cy="18" r="1.5" />
            </svg>
          </div>
          <div className="w-5 h-5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0">
            {index + 1}
          </div>
        </div>

        {/* Select оператора */}
        <select
          value={rule.operator}
          onChange={(e) => {
            const operator = e.target.value as ConditionOperator;
            // «Между» без инициализации второй границы давало вырожденный
            // диапазон [value, value]: линия порога строилась, окраска — нет
            onUpdate(rule.id, {
              operator,
              ...(operator === 'between' && rule.value2 === undefined
                ? { value2: rule.value }
                : {}),
            });
          }}
          className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded text-xs py-1.5 px-2 w-[100px] focus:ring-1 focus:ring-indigo-500 outline-none"
          {...stopDragEvents}
        >
          <option value=">">Больше (&gt;)</option>
          <option value=">=">Больше или равн. (≥)</option>
          <option value="<">Меньше (&lt;)</option>
          <option value="<=">Меньше или равн. (≤)</option>
          <option value="between">Между (..)</option>
          <option value="==">Равно (=)</option>
        </select>

        {/* Значения */}
        <div className="flex flex-1 gap-1 items-center">
          <input
            type="number"
            value={rule.value}
            onChange={(e) => onUpdate(rule.id, { value: parseNumber(e.target.value) })}
            className="w-full min-w-[50px] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded text-xs py-1.5 px-2 focus:ring-1 focus:ring-indigo-500 outline-none"
            placeholder="0"
            {...stopDragEvents}
          />
          {rule.operator === 'between' && (
            <>
              <span className="text-slate-400 text-xs">-</span>
              <input
                type="number"
                value={rule.value2 ?? 0}
                onChange={(e) => onUpdate(rule.id, { value2: parseNumber(e.target.value) })}
                className="w-full min-w-[50px] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded text-xs py-1.5 px-2 focus:ring-1 focus:ring-indigo-500 outline-none"
                placeholder="Max"
                {...stopDragEvents}
              />
            </>
          )}
        </div>

        {/* Кнопки действий */}
        <div className="flex gap-0.5 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate(rule);
            }}
            className="text-slate-400 hover:text-indigo-500 transition-colors p-1"
            type="button"
            aria-label="Дублировать правило"
            {...stopDragEvents}
          >
            <Copy size={13} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(rule.id);
            }}
            className="text-slate-400 hover:text-red-500 transition-colors p-1"
            type="button"
            aria-label="Удалить правило"
            {...stopDragEvents}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* ─── Цветовой пикер (НЕ drag-зона) ─── */}
      <div className="flex gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-700/50 justify-between items-center">
        <span className="text-[10px] text-slate-400 uppercase font-bold">Цвет</span>
        <div className="flex gap-1">
          {(Object.keys(COLOR_STYLES) as MetricColor[]).map((colorKey) => (
            <button
              key={colorKey}
              onClick={(e) => {
                e.stopPropagation();
                onUpdate(rule.id, { color: colorKey });
              }}
              className={cn(
                'w-5 h-5 rounded-full border-2 transition-all',
                rule.color === colorKey
                  ? 'border-slate-900 dark:border-white scale-110 shadow-sm'
                  : 'border-transparent opacity-50 hover:opacity-100'
              )}
              style={{ backgroundColor: METRIC_COLOR_HEX[colorKey] }}
              title={colorKey}
              type="button"
              aria-label={`Выбрать цвет ${colorKey}`}
              {...stopDragEvents}
            />
          ))}
        </div>
      </div>
    </div>
  );
});