'use client';
import { useEffect, useState, useRef, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { FormattingRule, MetricColor } from '@/entities/dashboard';

const METRIC_COLOR_HEX: Record<MetricColor, string> = {
  emerald: '#10b981', rose:    '#f43f5e', amber:   '#f59e0b',
  blue:    '#3b82f6', indigo:  '#6366f1', slate:   '#94a3b8',
};

function getOperatorLabel(op: string): string {
  switch (op) {
    case '>': return '>';    case '>=': return '≥';
    case '<': return '<';    case '<=': return '≤';
    case '==': return '=';   case '!=': return '≠';
    case 'between': return '↔'; default: return op;
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
 * Универсальный HTML-портал для popup'ов пороговых значений.
 * Рендерится в document.body, игнорируя overflow-hidden родителей.
 */
export const ThresholdPopup = memo(function ThresholdPopup({
  anchorRect, thresholdValue, rules, open,
  placement = 'top', onMouseEnter, onMouseLeave,
}: ThresholdPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [arrowSide, setArrowSide] = useState<'top' | 'bottom' | 'left' | 'right'>('bottom');

  useEffect(() => {
    if (!open || !anchorRect || !popupRef.current) return;
    
    const popup = popupRef.current;
    const pRect = popup.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const GAP = 10;

    // Пробуем preferred placement, затем fallback'и
    const candidates = [placement, 'bottom', 'top', 'right', 'left'] as const;
    const unique = candidates.filter((v, i, a) => a.indexOf(v) === i);

    for (const pos of unique) {
      let top = 0, left = 0, fits = true;

      switch (pos) {
        case 'top':
          top = anchorRect.top - pRect.height - GAP;
          left = anchorRect.left + anchorRect.width / 2 - pRect.width / 2;
          if (top < GAP) fits = false;
          setArrowSide('bottom');
          break;
        case 'bottom':
          top = anchorRect.bottom + GAP;
          left = anchorRect.left + anchorRect.width / 2 - pRect.width / 2;
          if (top + pRect.height > vh - GAP) fits = false;
          setArrowSide('top');
          break;
        case 'left':
          top = anchorRect.top + anchorRect.height / 2 - pRect.height / 2;
          left = anchorRect.left - pRect.width - GAP;
          if (left < GAP) fits = false;
          setArrowSide('right');
          break;
        case 'right':
          top = anchorRect.top + anchorRect.height / 2 - pRect.height / 2;
          left = anchorRect.right + GAP;
          if (left + pRect.width > vw - GAP) fits = false;
          setArrowSide('left');
          break;
      }

      // Корректировка, чтобы не выходить за края экрана
      if (pos === 'top' || pos === 'bottom') {
        if (left < GAP) left = GAP;
        if (left + pRect.width > vw - GAP) left = vw - pRect.width - GAP;
      }
      if (pos === 'left' || pos === 'right') {
        if (top < GAP) top = GAP;
        if (top + pRect.height > vh - GAP) top = vh - pRect.height - GAP;
      }

      if (fits || unique.indexOf(pos) === unique.length - 1) {
        setPosition({ top, left });
        break;
      }
    }
  }, [anchorRect, open, placement]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={popupRef}
      className="fixed z-[9999] animate-in fade-in zoom-in-95 duration-150"
      style={{ top: position.top, left: position.left }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="w-[340px] bg-slate-900/95 backdrop-blur-md text-white rounded-xl shadow-2xl border border-slate-700/50 overflow-hidden ring-1 ring-black/20">
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
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800/70 transition-colors group"
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
            {Array.from(new Set(rules.map(r => r.rule.color))).slice(0, 4).map((c, i) => (
              <div
                key={i}
                className="w-3 h-3 rounded-full border border-slate-900"
                style={{ backgroundColor: METRIC_COLOR_HEX[c as MetricColor] }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
});