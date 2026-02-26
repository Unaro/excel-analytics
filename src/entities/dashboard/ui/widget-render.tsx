'use client';

import { DashboardWidget, DashboardComputationResult } from '@/types';
import { Card } from '@/shared/ui/card';
import { formatNumber } from '@/shared/lib/utils/format';
import { Type, Activity } from 'lucide-react';

interface WidgetRendererProps {
  widget: DashboardWidget;
  isComputing: boolean;
}

export function WidgetRenderer({ widget, isComputing }: WidgetRendererProps) {
  // Рендерим в зависимости от типа
  switch (widget.type) {
    case 'metric':
      return <MetricWidget widget={widget} isLoading={isComputing} />;
    case 'text':
      return <TextWidget widget={widget} />;
    default:
      return null;
  }
}

// --- 1. Виджет-Метрика (KPI Card) ---
// Показывает одно число. Например: "Общая мощность школ"
function MetricWidget({ widget, isLoading }: { widget: DashboardWidget, result?: DashboardComputationResult, isLoading: boolean }) {
  // В конфиге виджета мы должны хранить, какую именно метрику показывать.
  // Тип MetricCardConfig: { groupId: string, metricId: string, ... }
  
  // Проблема: result.groups содержит массив групп. Нам нужно найти нужную группу и нужную метрику в ней.
  // Но наши ComputedResult сейчас возвращают только VirtualMetrics!
  // А MetricWidget в типах ссылается на metricId.
  
  // РЕШЕНИЕ: Для виджетов нужно будет или:
  // А) Ссылаться на VirtualMetric (колонку) + Group (строку) -> "Ячейка таблицы"
  // Б) Вычислять агрегат (Сумма всей колонки VirtualMetric) -> "Итого по дашборду"
  
  // Давай реализуем вариант (Б) - "Итого по колонке", это чаще всего нужно в хедерах.
  // Для этого нужно будет немного схитрить: просуммировать значения из result.groups.
  
  // ПОКА ЧТО (MVP): Предположим, widget.config хранит { virtualMetricId: string, aggregation: 'sum' | 'avg' }
  // Нам придется привести типы, так как в types.ts там MetricCardConfig немного другой.
  // Давай пока сделаем заглушку с рандомными данными или простую реализацию для Text.
  
//   const config = widget.config as any; 
  const value = 12345; // Placeholder

  return (
    <Card className="p-5 flex flex-col justify-between h-full hover:border-indigo-300 transition-colors dark:hover:border-indigo-700">
      <div className="flex justify-between items-start">
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {widget.title}
        </span>
        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg">
          <Activity size={18} />
        </div>
      </div>
      
      <div className="mt-4">
        {isLoading ? (
          <div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
        ) : (
          <div className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            {formatNumber(value)}
          </div>
        )}
        {widget.description && (
          <p className="text-xs text-slate-400 mt-1">{widget.description}</p>
        )}
      </div>
    </Card>
  );
}

// --- 2. Текстовый виджет ---
// Просто заголовок и текст (инструкция или описание)
function TextWidget({ widget }: { widget: DashboardWidget }) {
  const config = widget.config as { content: string };
  
  return (
    <Card className="p-5 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-2 text-slate-900 dark:text-white font-semibold">
        <Type size={16} className="text-slate-400" />
        {widget.title}
      </div>
      <div className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
        {config.content}
      </div>
    </Card>
  );
}