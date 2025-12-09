'use client';

import { useMemo } from 'react';
import { evaluate } from 'mathjs'; // <--- Импортируем mathjs
import { useExcelDataStore } from '@/lib/stores/excel-data-store';
import { useMetricTemplateStore } from '@/lib/stores/metric-template-store';
import { HierarchyFilterValue, KPIWidget, MetricTemplate } from '@/types';
import { formatCompactNumber } from '@/lib/utils/format';

// Хелпер нормализации
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
  const sheets = useExcelDataStore((s) => s.data);
  const templates = useMetricTemplateStore((s) => s.templates);

  // 1. Получаем плоский список строк (DATASET)
  const allRows = useMemo(() => {
    if (!sheets) return [];
    return sheets.flatMap((s) => s.rows);
  }, [sheets]);

  // 2. Фильтрация данных (O(N))
  const filteredRows = useMemo(() => {
    if (filters.length === 0) return allRows;
    return allRows.filter((row) => {
      return filters.every((filter) => {
        const rowVal = normalizeValue(row[filter.columnName]);
        const filterVal = normalizeValue(filter.value);
        return rowVal === filterVal;
      });
    });
  }, [allRows, filters]);

  // 3. Вычисление с MathJS
  const results = useMemo(() => {
    if (widgets.length === 0) return [];

    const calculatedValues = new Map<string, number>(); // Cache: widgetId -> value
    const resultsMap = new Map<string, KPIResult>();

    // Рекурсивная функция расчета
    const calculateWidget = (widgetId: string, stack: string[] = []): number => {
      // Проверка на циклические зависимости
      if (stack.includes(widgetId)) throw new Error('Циклическая зависимость');
      
      // Возврат из кеша, если уже посчитали в этом цикле
      if (calculatedValues.has(widgetId)) return calculatedValues.get(widgetId)!;

      const widget = widgets.find(w => w.id === widgetId);
      if (!widget) throw new Error('Виджет не найден');

      const template = templates.find(t => t.id === widget.templateId);
      if (!template) throw new Error('Шаблон не найден');

      let resultValue = 0;

      // --- ТИП A: АГРЕГАЦИЯ (Считаем по Excel данным) ---
      if (template.type === 'aggregate') {
        const fieldVariable = template.aggregateField || 'value';
        const columnAlias = widget.bindings[fieldVariable];

        if (!columnAlias) throw new Error(`Колонка "${fieldVariable}" не привязана`);

        const values = filteredRows
          .map(r => r[columnAlias])
          .filter(v => typeof v === 'number') as number[];

        switch (template.aggregateFunction) {
          case 'SUM': resultValue = values.reduce((a, b) => a + b, 0); break;
          case 'AVG': resultValue = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0; break;
          case 'MIN': resultValue = values.length ? Math.min(...values) : 0; break;
          case 'MAX': resultValue = values.length ? Math.max(...values) : 0; break;
          case 'COUNT': resultValue = filteredRows.filter(r => r[columnAlias] != null && r[columnAlias] !== '').length; break;
          default: resultValue = 0;
        }
      } 
      
      // --- ТИП B: ВЫЧИСЛЯЕМОЕ (Считаем через MathJS) ---
      else if (template.type === 'calculated' && template.formula) {
        const scope: Record<string, number> = {};

        // 1. Разрешаем зависимости
        // Проходимся по всем привязкам (bindings), которые есть у виджета
        // bindings: { "variableName": "targetWidgetId" }
        for (const [varName, targetWidgetId] of Object.entries(widget.bindings)) {
           // Рекурсивно считаем значение зависимого виджета
           const dependencyValue = calculateWidget(targetWidgetId, [...stack, widgetId]);
           scope[varName] = dependencyValue;
        }

        // 2. Вычисляем формулу через MathJS
        try {
          const mathResult = evaluate(template.formula, scope);
          
          // Проверка на Infinity или NaN (деление на ноль)
          if (!isFinite(mathResult) || isNaN(mathResult)) {
            resultValue = 0; // Или можно выбрасывать ошибку, зависит от бизнес-логики
          } else {
            resultValue = Number(mathResult);
          }
        } catch (e) {
          console.error(`MathJS Error in widget ${widget.customName}:`, e);
          throw new Error('Ошибка формулы');
        }
      }

      // Кешируем
      calculatedValues.set(widgetId, resultValue);
      
      // Форматируем для UI
      let formatted = formatCompactNumber(resultValue);
      if (template.displayFormat === 'percent') formatted = `${resultValue.toFixed(template.decimalPlaces)}%`;
      else if (template.displayFormat === 'currency') formatted = `${resultValue.toLocaleString()} ₽`;
      else if (template.displayFormat === 'decimal') formatted = resultValue.toLocaleString(undefined, { maximumFractionDigits: template.decimalPlaces });

      resultsMap.set(widgetId, {
        widget,
        template,
        value: resultValue,
        formattedValue: formatted
      });

      return resultValue;
    };

    // Запускаем расчет
    widgets.forEach(w => {
      try {
        calculateWidget(w.id);
      } catch (e) {
        // Fallback при ошибке
        const template = templates.find(t => t.id === w.templateId);
        resultsMap.set(w.id, {
          widget: w,
          template: template!, 
          value: 0,
          formattedValue: 'Error',
          error: e instanceof Error ? e.message : 'Error'
        });
      }
    });

    // Возвращаем результаты в порядке виджетов
    return widgets.map(w => resultsMap.get(w.id)).filter(Boolean) as KPIResult[];

  }, [filteredRows, widgets, templates]);

  return results;
}