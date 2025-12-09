'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Settings, Plus, Trash2, GripVertical } from 'lucide-react';
import { VirtualMetric, FormattingRule, ConditionOperator, MetricColor } from "@/types/dashboards";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import { COLOR_STYLES } from "@/lib/utils/metric-colors";
import { cn } from "@/lib/utils";
import { nanoid } from "nanoid"; // Если nanoid не установлен, можно использовать crypto.randomUUID()

interface MetricConfigPopoverProps {
  dashboardId: string;
  metric: VirtualMetric;
}

export function MetricConfigPopover({ dashboardId, metric }: MetricConfigPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  
  const updateMetric = useDashboardStore((s) => s.updateVirtualMetric);
  const rules = metric.colorConfig?.rules || [];

  const toggleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY + 5,
        left: rect.left + window.scrollX - 250 // Чуть шире, сдвигаем левее
      });
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (target.closest('.metric-popover-content') || target.closest('.metric-settings-btn')) return;
      setIsOpen(false);
    }
    window.addEventListener('scroll', () => setIsOpen(false), { capture: true });
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener('scroll', () => setIsOpen(false), { capture: true });
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // --- ACTIONS ---

  const addRule = () => {
    const newRule: FormattingRule = {
      id: nanoid(), // или crypto.randomUUID()
      operator: '>',
      value: 0,
      color: 'emerald'
    };
    updateMetric(dashboardId, metric.id, {
      colorConfig: { rules: [...rules, newRule] }
    });
  };

  const removeRule = (ruleId: string) => {
    updateMetric(dashboardId, metric.id, {
      colorConfig: { rules: rules.filter(r => r.id !== ruleId) }
    });
  };

  const updateRule = (ruleId: string, updates: Partial<FormattingRule>) => {
    updateMetric(dashboardId, metric.id, {
      colorConfig: {
        rules: rules.map(r => r.id === ruleId ? { ...r, ...updates } : r)
      }
    });
  };

  // --- RENDER ---

  const popoverContent = (
    <div 
      className="metric-popover-content fixed z-[9999] w-[340px] bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-100 flex flex-col max-h-[400px]"
      style={{ top: coords.top, left: coords.left }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-3 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 rounded-t-xl flex justify-between items-center">
        <h4 className="font-semibold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Правила цвета: {metric.name}
        </h4>
        <button onClick={addRule} className="text-indigo-600 hover:text-indigo-700 text-xs font-medium flex items-center gap-1">
          <Plus size={14} /> Добавить
        </button>
      </div>
      
      <div className="p-2 overflow-y-auto custom-scrollbar space-y-2 flex-1 min-h-[100px]">
        {rules.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-sm">
            Нет правил раскраски.<br/>Нажмите &quot;Добавить&quot;
          </div>
        ) : (
          rules.map((rule, index) => (
            <div key={rule.id} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
              
              {/* Оператор */}
              <select
                value={rule.operator}
                onChange={(e) => updateRule(rule.id, { operator: e.target.value as ConditionOperator })}
                className="w-[50px] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded text-xs py-1 px-1 focus:ring-1 focus:ring-indigo-500 outline-none"
              >
                <option value=">">&gt;</option>
                <option value=">=">&ge;</option>
                <option value="<">&lt;</option>
                <option value="<=">&le;</option>
                <option value="==">=</option>
                <option value="!=">&ne;</option>
              </select>

              {/* Значение */}
              <input
                type="number"
                value={rule.value}
                onChange={(e) => updateRule(rule.id, { value: parseFloat(e.target.value) || 0 })}
                className="w-[70px] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded text-xs py-1 px-2 focus:ring-1 focus:ring-indigo-500 outline-none"
                placeholder="0"
              />

              {/* Выбор цвета */}
              <div className="flex-1 flex gap-1 justify-end">
                {(Object.keys(COLOR_STYLES) as MetricColor[]).map((colorKey) => (
                  <button
                    key={colorKey}
                    onClick={() => updateRule(rule.id, { color: colorKey })}
                    className={cn(
                      "w-5 h-5 rounded-full border-2 transition-transform hover:scale-110",
                      rule.color === colorKey 
                         ? "border-slate-900 dark:border-white scale-110" 
                         : "border-transparent opacity-70 hover:opacity-100"
                    )}
                    style={{ backgroundColor: getColorHex(colorKey) }}
                    title={colorKey}
                  />
                ))}
              </div>

              {/* Удалить */}
              <button 
                onClick={() => removeRule(rule.id)}
                className="text-slate-400 hover:text-red-500 transition-colors p-1"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
      
      <div className="p-2 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/30 rounded-b-xl text-[10px] text-slate-400 text-center">
        Применяется первое подходящее правило сверху вниз
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
      >
        <Settings size={14} />
      </button>
      {isOpen && typeof document !== 'undefined' && createPortal(popoverContent, document.body)}
    </>
  );
}

// Хелпер для отрисовки кружочков выбора цвета (примерные HEX для UI)
function getColorHex(color: MetricColor): string {
  switch (color) {
    case 'emerald': return '#10b981';
    case 'rose': return '#f43f5e';
    case 'amber': return '#f59e0b';
    case 'blue': return '#3b82f6';
    case 'indigo': return '#6366f1';
    case 'slate': return '#64748b';
    default: return '#ccc';
  }
}