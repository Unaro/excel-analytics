'use client';

import { useState, useRef, useEffect } from 'react';
import { Settings2, Check } from 'lucide-react';
import { VirtualMetric } from "@/entities/dashboard";
import { cn } from "@/shared/lib/utils";

interface MetricsSelectorProps {
  metrics: VirtualMetric[];
  hiddenMetricIds: string[];
  onToggleMetric: (id: string) => void;
}

export function MetricsSelector({ metrics, hiddenMetricIds, onToggleMetric }: MetricsSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Закрытие при клике вне компонента
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const activeCount = metrics.length - hiddenMetricIds.length;

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 border rounded-md transition text-sm font-medium shadow-sm",
          isOpen 
            ? "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white"
            : "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800"
        )}
      >
        <Settings2 size={16} />
        <span className="hidden sm:inline">Таблица</span>
        <span className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 text-[10px] py-0.5 px-1.5 rounded-md ml-1 min-w-5 text-center">
          {activeCount}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 z-50 animate-in fade-in slide-in-from-top-2 duration-200 flex flex-col max-h-[400px]">
          <div className="p-3 border-b border-gray-100 dark:border-slate-800">
            <h4 className="font-semibold text-sm text-slate-900 dark:text-white">Колонки таблицы</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">Скройте лишние показатели</p>
          </div>
          <div className="p-2 overflow-y-auto custom-scrollbar flex-1">
            {metrics.map((metric) => {
              const isVisible = !hiddenMetricIds.includes(metric.id);
              return (
                <button
                  key={metric.id}
                  onClick={() => onToggleMetric(metric.id)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition text-left group"
                >
                  <span className={cn("text-sm truncate mr-2", isVisible ? "text-slate-700 dark:text-slate-200 font-medium" : "text-slate-400 dark:text-slate-500")}>
                    {metric.name}
                  </span>
                  <div className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0",
                    isVisible 
                      ? "bg-indigo-600 border-indigo-600 text-white" 
                      : "border-slate-300 dark:border-slate-600 group-hover:border-indigo-400"
                  )}>
                    {isVisible && <Check size={10} strokeWidth={3} />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}