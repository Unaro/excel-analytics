'use client';

import { KPIWidget, HierarchyFilterValue } from '@/types';
import { useKPICalculation } from '@/lib/hooks/use-kpi-calculation';
import { Card } from '@/shared/ui/card';
import { Layers, Trash2, Calculator } from 'lucide-react';
import { useDashboardStore } from '@/entities/dashboard';
import { cn } from '@/shared/lib/utils';

interface KPIGridProps {
  dashboardId: string;
  widgets: KPIWidget[];
  currentFilters: HierarchyFilterValue[];
  isEditMode?: boolean; // Чтобы показывать кнопки удаления
}

export function KPIGrid({ dashboardId, widgets, currentFilters, isEditMode = false }: KPIGridProps) {
  // Вызываем хук расчетов
  const results = useKPICalculation(widgets, currentFilters);
  const removeWidget = useDashboardStore(s => s.removeKPIWidget);

  if (results.length === 0) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
      {results.map(({ widget, template, formattedValue, error }) => (
        <Card key={widget.id} className="relative p-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-all group">
          
          {isEditMode && (
            <button 
              onClick={() => removeWidget(dashboardId, widget.id)}
              className="absolute top-2 right-2 p-1.5 bg-rose-50 text-rose-500 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-100"
            >
              <Trash2 size={14} />
            </button>
          )}

          <div className="flex items-center gap-3 mb-2">
            <div className={cn(
              "p-2 rounded-lg",
              widget.color === 'emerald' ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20" :
              widget.color === 'rose' ? "bg-rose-50 text-rose-600 dark:bg-rose-900/20" :
              widget.color === 'amber' ? "bg-amber-50 text-amber-600 dark:bg-amber-900/20" :
              "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20"
            )}>
              {/* Иконку можно вывести в зависимости от template.type */}
                {template?.type === 'aggregate' ? <Layers size={18}/> : <Calculator size={18}/>}
            </div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate" title={widget.customName || template?.name}>
                {widget.customName || template?.name}
            </div>
          </div>

          <div className="flex items-baseline gap-1.5">
            {error ? <span className="text-red-500 text-sm">{error}</span> : formattedValue}
            {/* Unit берем из виджета или шаблона */}
            <span className="text-sm font-medium text-slate-400">
                {template?.suffix}
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}