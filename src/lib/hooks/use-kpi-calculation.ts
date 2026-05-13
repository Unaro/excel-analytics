'use client';
import { useMemo } from 'react';
import { safeEvaluate } from '@/lib/logic/safe-math';
import { useDatasetStore } from '@/entities/dataset';
import { useMetricTemplateStore } from '@/entities/metric';
import { HierarchyFilterValue, KPIWidget, MetricTemplate } from '@/types';
import { formatCompactNumber } from '@/shared/lib/utils/format';

function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export interface KPIResult {
  widget: KPIWidget;
  template: MetricTemplate;
  value: number;
  formattedValue: string;
  error?: string;
}

export function useKPICalculation(
  widgets: KPIWidget[],
  filters: HierarchyFilterValue[]
): KPIResult[] {
  const allRows = useDatasetStore(s => s.getAllData());
  const templates = useMetricTemplateStore(s => s.templates);

  const filteredRows = useMemo(() => {
    if (filters.length === 0) return allRows;
    return allRows.filter((row) => {
      return filters.every((filter) => {
        const rowVal = normalizeValue((row as Record<string, unknown>)[filter.columnName]);
        const filterVal = normalizeValue(filter.value);
        return rowVal === filterVal;
      });
    });
  }, [allRows, filters]);

  const results = useMemo(() => {
    if (widgets.length === 0) return [];
    const calculatedValues = new Map<string, number>();
    const resultsMap = new Map<string, KPIResult>();

    const calculateWidget = (widgetId: string, stack: string[] = []): number => {
      if (stack.includes(widgetId)) throw new Error('Циклическая зависимость');
      if (calculatedValues.has(widgetId)) return calculatedValues.get(widgetId)!;

      const widget = widgets.find(w => w.id === widgetId);
      if (!widget) throw new Error('Виджет не найден');
      const template = templates.find(t => t.id === widget.templateId);
      if (!template) throw new Error('Шаблон не найден');

      let resultValue = 0;

      if (template.type === 'aggregate') {
        const fieldVariable = template.aggregateField || 'value';
        const columnAlias = widget.bindings[fieldVariable];
        if (!columnAlias) throw new Error(`Колонка "${fieldVariable}" не привязана`);

        const values = filteredRows
          .map(r => (r as Record<string, unknown>)[columnAlias])
          .filter(v => typeof v === 'number') as number[];

        switch (template.aggregateFunction) {
          case 'SUM': resultValue = values.reduce((a, b) => a + b, 0); break;
          case 'AVG': resultValue = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0; break;
          case 'MIN': resultValue = values.length ? Math.min(...values) : 0; break;
          case 'MAX': resultValue = values.length ? Math.max(...values) : 0; break;
          case 'COUNT': resultValue = filteredRows.filter(r => {
            const val = (r as Record<string, unknown>)[columnAlias];
            return val != null && val !== '';
          }).length; break;
          default: resultValue = 0;
        }
      } else if (template.type === 'calculated' && template.formula) {
        const scope: Record<string, number> = {};
        for (const [varName, targetWidgetId] of Object.entries(widget.bindings)) {
          scope[varName] = calculateWidget(targetWidgetId, [...stack, widgetId]);
        }
        // Безопасное вычисление через общую утилиту (гарантирует результат как на сервере)
        resultValue = safeEvaluate(template.formula, scope) ?? 0;
      }

      calculatedValues.set(widgetId, resultValue);
      let formatted = formatCompactNumber(resultValue);
      if (template.displayFormat === 'percent') formatted = `${resultValue.toFixed(template.decimalPlaces)}%`;
      else if (template.displayFormat === 'currency') formatted = `${resultValue.toLocaleString()} ₽`;
      else if (template.displayFormat === 'decimal') formatted = resultValue.toLocaleString(undefined, { maximumFractionDigits: template.decimalPlaces });

      resultsMap.set(widgetId, { widget, template, value: resultValue, formattedValue: formatted });
      return resultValue;
    };

    widgets.forEach(w => {
      try { calculateWidget(w.id); }
      catch (e) {
        const template = templates.find(t => t.id === w.templateId);
        resultsMap.set(w.id, { widget: w, template: template!, value: 0, formattedValue: 'Error', error: e instanceof Error ? e.message : 'Error' });
      }
    });

    return widgets.map(w => resultsMap.get(w.id)).filter(Boolean) as KPIResult[];
  }, [filteredRows, widgets, templates]);

  return results;
}