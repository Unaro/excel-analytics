'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Settings, Plus, Trash2 } from 'lucide-react';
import { FormattingRule, ConditionOperator, MetricColor } from "@/entities/dashboard";
import { useDashboardStore } from "@/entities/dashboard";
import { COLOR_STYLES } from "@/shared/lib/utils/metric-colors";
import { cn } from "@/shared/lib/utils";
import { nanoid } from "nanoid";

interface MetricConfigPopoverProps {
  dashboardId: string;
  metricId: string;
}

export function MetricConfigPopover({ dashboardId, metricId }: MetricConfigPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; side: 'top' | 'bottom' }>({ 
    top: 0, 
    left: 0, 
    side: 'bottom' 
  });
  
  const metric = useDashboardStore(useCallback((state) => {
    const dashboard = state.dashboards.find(d => d.id === dashboardId);
    return dashboard?.virtualMetrics.find(m => m.id === metricId);
  }, [dashboardId, metricId]));

  if (!metric) return null;

  const updateMetric = useDashboardStore((s) => s.updateVirtualMetric);
  
  const rules = useMemo(() => metric.colorConfig?.rules || [], [metric.colorConfig?.rules]);
  const currentColorConfig = useMemo(() => metric.colorConfig, [metric.colorConfig]);

  const toggleOpen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const POPOVER_HEIGHT = 420;
      const SCREEN_PADDING = 10;

      const spaceBelow = window.innerHeight - rect.bottom;
      const showOnTop = spaceBelow < POPOVER_HEIGHT;

      let top = showOnTop 
        ? rect.top + window.scrollY - 5 
        : rect.bottom + window.scrollY + 5;

      const POPOVER_WIDTH = 340;
      let left = rect.left + window.scrollX - 250;

      if (left + POPOVER_WIDTH > window.innerWidth) {
        left = window.innerWidth - POPOVER_WIDTH - SCREEN_PADDING;
      }
      if (left < SCREEN_PADDING) {
        left = SCREEN_PADDING;
      }

      setPosition({ top, left, side: showOnTop ? 'top' : 'bottom' });
    }
    
    setIsOpen(prev => !prev);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.metric-popover-content') || target.closest('.metric-settings-btn')) return;
      setIsOpen(false);
    }

    function handleScroll(event: Event) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.metric-popover-content')) return;
      setIsOpen(false);
    }

    window.addEventListener('scroll', handleScroll, { capture: true });
    document.addEventListener("mousedown", handleClickOutside);
    
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const addRule = useCallback(() => {
    const newRule: FormattingRule = {
      id: nanoid(),
      operator: '>',
      value: 0,
      color: 'emerald'
    };
    
    updateMetric(dashboardId, metricId, {
      colorConfig: {
        ...(currentColorConfig || {}),
        rules: [...(currentColorConfig?.rules || []), newRule]
      }
    });
  }, [dashboardId, metricId, updateMetric, currentColorConfig]);

  const removeRule = useCallback((ruleId: string) => {
    updateMetric(dashboardId, metricId, {
      colorConfig: {
        ...(currentColorConfig || {}),
        rules: (currentColorConfig?.rules || []).filter(r => r.id !== ruleId)
      }
    });
  }, [dashboardId, metricId, updateMetric, currentColorConfig]);

  const updateRule = useCallback((ruleId: string, updates: Partial<FormattingRule>) => {
    updateMetric(dashboardId, metricId, {
      colorConfig: {
        ...(currentColorConfig || {}),
        rules: (currentColorConfig?.rules || []).map(r => 
          r.id === ruleId ? { ...r, ...updates } : r
        )
      }
    });
  }, [dashboardId, metricId, updateMetric, currentColorConfig]);

  const getColorHex = useCallback((color: MetricColor): string => {
    const map: Record<MetricColor, string> = {
      emerald: '#10b981',
      rose: '#f43f5e',
      amber: '#f59e0b',
      blue: '#3b82f6',
      indigo: '#6366f1',
      slate: '#94a3b8',
    };
    return map[color] || '#ccc';
  }, []);

  const popoverContent = (
    <div 
      className={cn(
        "metric-popover-content fixed z-9999 w-[350px] flex flex-col max-h-[420px]",
        "bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700",
        "animate-in fade-in zoom-in-95 duration-150"
      )}
      style={{ 
        top: position.top, 
        left: position.left,
        transform: position.side === 'top' ? 'translateY(-100%)' : 'none'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-3 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 rounded-t-xl flex justify-between items-center shrink-0">
        <h4 className="font-semibold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Условное форматирование
        </h4>
        <button 
          onClick={addRule} 
          className="text-indigo-600 hover:text-indigo-700 text-xs font-medium flex items-center gap-1"
          type="button"
        >
          <Plus size={14} /> Добавить
        </button>
      </div>
      
      <div className="p-2 overflow-y-auto custom-scrollbar space-y-2 flex-1 min-h-[100px]">
        {rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
            <Settings size={24} className="opacity-20" />
            <span className="text-sm">Нет правил</span>
          </div>
        ) : (
          rules.map((rule) => (
            <div key={rule.id} className="flex flex-col gap-2 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 w-full">
                <select
                  value={rule.operator}
                  onChange={(e) => updateRule(rule.id, { operator: e.target.value as ConditionOperator })}
                  className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded text-xs py-1.5 px-2 w-[100px] focus:ring-1 focus:ring-indigo-500 outline-none"
                >
                  <option value=">">Больше (&gt;)</option>
                  <option value=">=">Больше или равн. (&ge;)</option>
                  <option value="<">Меньше (&lt;)</option>
                  <option value="<=">Меньше или равн. (&le;)</option>
                  <option value="between">Между (..)</option>
                  <option value="==">Равно (=)</option>
                </select>

                <div className="flex flex-1 gap-1 items-center">
                   <input
                      type="number"
                      value={rule.value}
                      onChange={(e) => updateRule(rule.id, { value: parseFloat(e.target.value) || 0 })}
                      className="w-full min-w-[50px] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded text-xs py-1.5 px-2 focus:ring-1 focus:ring-indigo-500 outline-none"
                      placeholder="0"
                    />
                    
                    {rule.operator === 'between' && (
                      <>
                        <span className="text-slate-400 text-xs">-</span>
                        <input
                          type="number"
                          value={rule.value2 ?? 0}
                          onChange={(e) => updateRule(rule.id, { value2: parseFloat(e.target.value) || 0 })}
                          className="w-full min-w-[50px] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded text-xs py-1.5 px-2 focus:ring-1 focus:ring-indigo-500 outline-none"
                          placeholder="Max"
                        />
                      </>
                    )}
                </div>

                <button 
                  onClick={() => removeRule(rule.id)}
                  className="text-slate-400 hover:text-red-500 transition-colors p-1"
                  type="button"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="flex gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-700/50 justify-between items-center">
                 <span className="text-[10px] text-slate-400 uppercase font-bold">Цвет</span>
                 <div className="flex gap-1">
                  {(Object.keys(COLOR_STYLES) as MetricColor[]).map((colorKey) => (
                    <button
                      key={colorKey}
                      onClick={() => updateRule(rule.id, { color: colorKey })}
                      className={cn(
                        "w-5 h-5 rounded-full border-2 transition-all",
                        rule.color === colorKey 
                          ? "border-slate-900 dark:border-white scale-110 shadow-sm" 
                          : "border-transparent opacity-50 hover:opacity-100"
                      )}
                      style={{ backgroundColor: getColorHex(colorKey) }}
                      title={colorKey}
                      type="button"
                    />
                  ))}
                 </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      <div className="p-2 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30 rounded-b-xl text-[10px] text-slate-400 text-center shrink-0">
         Правила применяются сверху вниз.
         <br/>Если диапазон 0..150 красный, ставь его выше.
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={buttonRef}
        onClick={toggleOpen}
        className={cn(
          "metric-settings-btn p-1 rounded-md transition-colors opacity-0 group-hover/th:opacity-100 focus:opacity-100 relative", 
          isOpen ? "bg-indigo-100 text-indigo-600 opacity-100" : "hover:bg-slate-100 text-slate-400"
        )}
        type="button"
      >
        <Settings size={14} />
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(popoverContent, document.body)}
    </>
  );
}