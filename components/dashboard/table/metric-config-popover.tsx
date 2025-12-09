'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom'; // <--- Важно для портала
import { Settings, Palette } from 'lucide-react';
import { VirtualMetric, ColorMode } from "@/types/dashboards";
import { useDashboardStore } from "@/lib/stores/dashboard-store";
import { cn } from "@/lib/utils";

interface MetricConfigPopoverProps {
  dashboardId: string;
  metric: VirtualMetric;
}

export function MetricConfigPopover({ dashboardId, metric }: MetricConfigPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null); // Ссылка на кнопку
  const [coords, setCoords] = useState({ top: 0, left: 0 }); // Координаты для попапа
  
  const updateMetric = useDashboardStore((s) => s.updateVirtualMetric);

  // Текущие настройки из пропса (который должен быть свежим из стора)
  const mode = metric.colorConfig?.mode || 'none';
  const isInverse = metric.colorConfig?.isInverse || false;

  // Вычисляем позицию при открытии
  const toggleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      // Позиционируем попап чуть ниже кнопки
      setCoords({
        top: rect.bottom + window.scrollY - 50,
        left: rect.left + window.scrollX - 200 // Сдвигаем влево, чтобы не вылез за экран справа
      });
    }
    setIsOpen(!isOpen);
  };

  // Закрытие при клике вне (теперь сложнее из-за портала)
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      // Проверяем, был ли клик НЕ по кнопке (попап мы не можем проверить через ref контейнера так просто, 
      // но так как он в портале, эвент баблинг работает специфично, упростим задачу)
      
      const target = event.target as HTMLElement;
      // Если клик был внутри нашего попапа (ищем по id или классу)
      if (target.closest('.metric-popover-content') || target.closest('.metric-settings-btn')) {
        return;
      }
      setIsOpen(false);
    }
    
    // Слушаем скролл, чтобы закрыть попап (так проще, чем пересчитывать позицию)
    window.addEventListener('scroll', () => setIsOpen(false), { capture: true }); 
    document.addEventListener("mousedown", handleClickOutside);
    
    return () => {
      window.removeEventListener('scroll', () => setIsOpen(false), { capture: true });
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleModeChange = (newMode: ColorMode) => {
    updateMetric(dashboardId, metric.id, {
      colorConfig: { mode: newMode, isInverse }
    });
  };

  const handleInverseChange = (newInverse: boolean) => {
    updateMetric(dashboardId, metric.id, {
      colorConfig: { mode: mode, isInverse: newInverse }
    });
  };

  // Контент попапа
  const popoverContent = (
    <div 
      className="metric-popover-content fixed z-[9999] w-72 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-100"
      style={{ top: coords.top, left: coords.left }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-3 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 rounded-t-xl">
        <h4 className="font-semibold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Настройка: {metric.name}
        </h4>
      </div>
      
      <div className="p-3 space-y-4">
        {/* 1. Включение цветов */}
        <div>
          <label className="text-sm font-medium text-slate-900 dark:text-white mb-2 flex items-center gap-2">
            <Palette size={16} className="text-indigo-500" />
            Цветовая индикация
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleModeChange('none')}
              className={cn(
                "px-3 py-2 text-xs font-medium rounded-lg border transition-all",
                mode === 'none' 
                  ? "bg-slate-800 text-white border-slate-800 dark:bg-white dark:text-slate-900" 
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300"
              )}
            >
              Нет
            </button>
            <button
              onClick={() => handleModeChange('positive_negative')}
              className={cn(
                "px-3 py-2 text-xs font-medium rounded-lg border transition-all",
                mode === 'positive_negative'
                  ? "bg-indigo-600 text-white border-indigo-600" 
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300"
              )}
            >
              +/- Цвет
            </button>
          </div>
        </div>

        {/* 2. Логика (Инверсия) */}
        {mode === 'positive_negative' && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-1">
            <label className="text-sm font-medium text-slate-900 dark:text-white mb-2 block">
              Логика значений
            </label>
            <div className="space-y-2">
              <button
                onClick={() => handleInverseChange(false)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs border text-left transition-colors",
                  !isInverse 
                    ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800 ring-1 ring-emerald-500" 
                    : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                )}
              >
                <span className="text-slate-700 dark:text-slate-300">Классическая</span>
                <div className="flex gap-1">
                  <span className="text-emerald-600 font-bold">+ Хорошо</span>
                  <span className="text-rose-600 font-bold">− Плохо</span>
                </div>
              </button>

              <button
                onClick={() => handleInverseChange(true)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs border text-left transition-colors",
                  isInverse 
                    ? "border-rose-200 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-800 ring-1 ring-rose-500" 
                    : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                )}
              >
                <span className="text-slate-700 dark:text-slate-300">Инверсия</span>
                <div className="flex gap-1">
                  <span className="text-rose-600 font-bold">+ Плохо</span>
                  <span className="text-emerald-600 font-bold">− Хорошо</span>
                </div>
              </button>
            </div>
          </div>
        )}
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
        title="Настроить отображение"
      >
        <Settings size={14} />
      </button>

      {/* Рендерим в портал (body), если открыто */}
      {isOpen && typeof document !== 'undefined' && createPortal(popoverContent, document.body)}
    </>
  );
}