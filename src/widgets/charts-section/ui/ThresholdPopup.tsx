'use client';

import { memo } from 'react';
import { createPortal } from 'react-dom';
import * as Popover from '@radix-ui/react-popover';
import { FormattingRule, MetricColor } from '@/entities/dashboard';
import { cn } from '@/shared/lib/utils';
import { METRIC_COLOR_HEX } from '@/shared/lib/utils/metric-colors';

function getOperatorLabel(op: string): string {
  switch (op) {
    case '>': return '>';    case '>=': return '≥';
    case '<': return '<';    case '<=': return '≤';
    case '==': return '=';   case '!=': return '≠';
    case 'between': return '↔';
    default: return op;
  }
}

export interface ThresholdRuleEntry {
  metricName: string;
  metricId: string;
  rule: FormattingRule;
}

export interface ThresholdPopupProps {
  anchorRect: DOMRect | null;
  thresholdValue: number;
  rules: ThresholdRuleEntry[];
  open: boolean;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

/**
 * Popup пороговых значений на Radix Popover.
 *
 * Internal компонент — используется только внутри ThresholdLabel.
 * НЕ экспортируется через публичный API виджета.
 *
 * Рендерится через portal в document.body для избежания
 * overflow: hidden конфликтов с Recharts SVG-контейнером.
 */
export const ThresholdPopup = memo(function ThresholdPopup({
  anchorRect,
  thresholdValue,
  rules,
  open,
  placement = 'top',
  onMouseEnter,
  onMouseLeave,
}: ThresholdPopupProps) {
  if (!open || !anchorRect) return null;
  if (typeof document === 'undefined') return null;

  const uniqueColors = Array.from(new Set(rules.map(r => r.rule.color))).slice(0, 4);

  return createPortal(
    <Popover.Root open={open}>
      <Popover.Anchor asChild>
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            top: anchorRect.top,
            left: anchorRect.left,
            width: Math.max(anchorRect.width, 1),
            height: Math.max(anchorRect.height, 1),
            pointerEvents: 'none',
            opacity: 0,
          }}
        />
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          side={placement}
          sideOffset={10}
          collisionPadding={10}
          avoidCollisions={true}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          className={cn(
            'w-[340px] bg-slate-900/95 backdrop-blur-md text-white',
            'rounded-xl shadow-2xl border border-slate-700/50',
            'overflow-hidden ring-1 ring-black/20',
            'origin-[--radix-popover-content-transform-origin]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[side=bottom]:slide-in-from-top-2',
            'data-[side=top]:slide-in-from-bottom-2',
            'data-[side=left]:slide-in-from-right-2',
            'data-[side=right]:slide-in-from-left-2',
            'z-[9999]'
          )}
        >
          {/* Заголовок */}
          <div className="px-4 py-3 border-b border-slate-700/50 bg-gradient-to-r from-slate-800/80 to-slate-800/40">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Пороговые значения
              </div>
            </div>
            <div className="font-mono text-base font-semibold text-white">
              Уровень: {thresholdValue.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}
            </div>
          </div>

          {/* Список правил */}
          <div className="p-2 space-y-0.5 max-h-[360px] overflow-y-auto custom-scrollbar">
            {rules.map((entry, i) => {
              const color = METRIC_COLOR_HEX[entry.rule.color];
              const op = getOperatorLabel(entry.rule.operator);
              const text = entry.rule.operator === 'between' && entry.rule.value2 != null
                ? `${entry.rule.value.toLocaleString('ru-RU')} – ${entry.rule.value2.toLocaleString('ru-RU')}`
                : `${op} ${entry.rule.value.toLocaleString('ru-RU')}`;

              return (
                <div
                  key={`${entry.metricId}-${i}`}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800/70 transition-colors"
                >
                  <div className="relative shrink-0">
                    <div
                      className="w-3 h-3 rounded-full ring-2 ring-white/10"
                      style={{ backgroundColor: color }}
                    />
                    <div
                      className="absolute inset-0 w-3 h-3 rounded-full animate-ping opacity-30"
                      style={{ backgroundColor: color }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-100 truncate leading-tight">
                      {entry.metricName}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {entry.rule.operator === 'between' ? 'Диапазон значений' : 'Условие срабатывания'}
                    </div>
                  </div>
                  <div
                    className="font-mono text-xs font-bold px-2.5 py-1 rounded-md shrink-0 border"
                    style={{
                      color,
                      backgroundColor: `${color}15`,
                      borderColor: `${color}30`,
                    }}
                  >
                    {text}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Футер */}
          <div className="px-4 py-2 border-t border-slate-700/50 bg-slate-800/30 flex items-center justify-between">
            <span className="text-[10px] text-slate-500">
              {rules.length === 1 ? '1 правило' : `${rules.length} правил`} на этом уровне
            </span>
            <div className="flex -space-x-1">
              {uniqueColors.map((c, i) => (
                <div
                  key={i}
                  className="w-3 h-3 rounded-full border border-slate-900"
                  style={{ backgroundColor: METRIC_COLOR_HEX[c as MetricColor] }}
                />
              ))}
            </div>
          </div>

          <Popover.Arrow className="fill-slate-900/95" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>,
    document.body
  );
});