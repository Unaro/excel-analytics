'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Settings, Plus, Trash2 } from 'lucide-react';
import { VirtualMetric, FormattingRule, ConditionOperator, MetricColor } from "@/entities/dashboard";
import { useDashboardStore } from "@/entities/dashboard";
import { COLOR_STYLES } from "@/shared/lib/utils/metric-colors";
import { cn } from "@/shared/lib/utils";
import { nanoid } from "nanoid";

interface MetricConfigPopoverProps {
  dashboardId: string;
  metric: VirtualMetric;
}

export function MetricConfigPopover({ dashboardId, metric }: MetricConfigPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  // Стейт координат + флаг, открываемся ли мы вверх
  const [position, setPosition] = useState<{ top: number; left: number; side: 'top' | 'bottom' }>({ top: 0, left: 0, side: 'bottom' });
  
  const updateMetric = useDashboardStore((s) => s.updateVirtualMetric);
  const rules = metric.colorConfig?.rules || [];

  const toggleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const POPOVER_HEIGHT = 420; // Примерная максимальная высота окна
      const SCREEN_PADDING = 10;

      // 1. Расчет вертикали (Smart Positioning)
      const spaceBelow = window.innerHeight - rect.bottom;
      const showOnTop = spaceBelow < POPOVER_HEIGHT; // Если снизу мало места -> вверх

      let top = 0;
      if (showOnTop) {
        // Позиция над кнопкой
        top = rect.top + window.scrollY - 5; 
      } else {
        // Позиция под кнопкой
        top = rect.bottom + window.scrollY + 5;
      }

      // 2. Расчет горизонтали (чтобы не ушло за правый край)
      const POPOVER_WIDTH = 340;
      let left = rect.left + window.scrollX - 250; // Сдвиг влево по умолчанию

      // Если вылезает справа
      if (left + POPOVER_WIDTH > window.innerWidth) {
        left = window.innerWidth - POPOVER_WIDTH - SCREEN_PADDING;
      }
      // Если вылезает слева
      if (left < SCREEN_PADDING) {
        left = SCREEN_PADDING;
      }

      setPosition({ top, left, side: showOnTop ? 'top' : 'bottom' });
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
    
    // Закрываем при скролле страницы, но НЕ при скролле внутри попапа
    function handleScroll(event: Event) {
      const target = event.target as HTMLElement;
      // Если скролл происходит внутри попапа — не закрываем
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

  // --- ACTIONS ---

  const addRule = () => {
    const newRule: FormattingRule = {
      id: nanoid(),
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

  // --- UI PART ---

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
        // Если открываемся вверх, нам нужно сдвинуть элемент на его высоту вверх (через transform)
        transform: position.side === 'top' ? 'translateY(-100%)' : 'none'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-3 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 rounded-t-xl flex justify-between items-center shrink-0">
        <h4 className="font-semibold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Условное форматирование
        </h4>
        <button onClick={addRule} className="text-indigo-600 hover:text-indigo-700 text-xs font-medium flex items-center gap-1">
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
                {/* 1. Оператор */}
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

                {/* 2. Значения */}
                <div className="flex flex-1 gap-1 items-center">
                   {/* Первое значение */}
                   <input
                      type="number"
                      value={rule.value}
                      onChange={(e) => updateRule(rule.id, { value: parseFloat(e.target.value) || 0 })}
                      className="w-full min-w-[50px] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded text-xs py-1.5 px-2 focus:ring-1 focus:ring-indigo-500 outline-none"
                      placeholder="0"
                    />
                    
                    {/* Второе значение (ТОЛЬКО ДЛЯ BETWEEN) */}
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

                {/* 3. Кнопка удаления */}
                <button 
                  onClick={() => removeRule(rule.id)}
                  className="text-slate-400 hover:text-red-500 transition-colors p-1"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* 4. Выбор цвета (отдельная строка для удобства) */}
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
      >
        <Settings size={14} />
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(popoverContent, document.body)}
    </>
  );
}

function getColorHex(color: MetricColor): string {
  switch (color) {
    case 'emerald': return '#10b981';
    case 'rose': return '#f43f5e';
    case 'amber': return '#f59e0b';
    case 'blue': return '#3b82f6';
    case 'indigo': return '#6366f1';
    case 'slate': return '#94a3b8';
    default: return '#ccc';
  }
}