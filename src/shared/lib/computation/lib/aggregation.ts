// shared/lib/computation/lib/aggregation.ts
import type { CompiledQuery, MetricAggregationMeta } from './types';
import { recalculateFormulasOnAggregated } from './post-process';

/**
 * Умная агрегация строк breakdown в одну сводную строку.
 * 
 * Единый источник правды для DuckDB и PostgreSQL engine'ов.
 * Применяет правильную математику для каждого типа агрегации:
 * 
 *  - SUM, COUNT, COUNT_DISTINCT → сумма значений
 *  - AVG → взвешенное среднее через SUM/COUNT
 *  - MAX → глобальный максимум
 *  - MIN → глобальный минимум
 *  - MEDIAN, PERCENTILE → приближённая медиана
 * 
 * После агрегации пересчитывает calculated-метрики (формулы)
 * на сводных значениях.
 * 
 * @param processedRows      - Массив строк после postProcessAggregates
 * @param aggregateMetadata  - Маппинг alias → тип агрегации
 * @param formulas           - Компилированные формулы calculated метрик
 */
export function aggregateProcessedRows(
  processedRows: Record<string, number | null>[],
  aggregateMetadata: Map<string, MetricAggregationMeta>,
  formulas: CompiledQuery['formulas']
): Record<string, number | null> {
  if (processedRows.length === 0) return {};

  const summary: Record<string, number | null> = {};
  const keys = Object.keys(processedRows[0]);

  // ═══════════════════════════════════════════════════════════
  // Этап 1: Агрегируем aggregate-метрики по их типу
  // ═══════════════════════════════════════════════════════════
  for (const key of keys) {
    // Пропускаем служебные колонки (они нужны только для AVG)
    if (key.startsWith('__agg_sum__') || key.startsWith('__agg_count__')) {
      summary[key] = null;
      continue;
    }
    if (key === '_group_label' || key === '_record_count') continue;

    const meta = aggregateMetadata.get(key);
    const values = processedRows
      .map(row => row[key])
      .filter((v): v is number => typeof v === 'number' && isFinite(v));

    if (values.length === 0) {
      summary[key] = null;
      continue;
    }

    switch (meta?.aggregateFunction) {
      case 'SUM':
      case 'COUNT':
      case 'COUNT_DISTINCT':
        summary[key] = values.reduce((a, b) => a + b, 0);
        break;

      case 'AVG': {
        const sumKey = `__agg_sum__${key}`;
        const countKey = `__agg_count__${key}`;
        let totalSum = 0;
        let totalCount = 0;
        for (const row of processedRows) {
          const s = typeof row[sumKey] === 'number' ? row[sumKey] : 0;
          const c = typeof row[countKey] === 'number' ? row[countKey] : 0;
          totalSum += s;
          totalCount += c;
        }
        summary[key] = totalCount > 0 ? totalSum / totalCount : null;
        break;
      }

      case 'MAX':
        summary[key] = Math.max(...values);
        break;

      case 'MIN':
        summary[key] = Math.min(...values);
        break;

      case 'MEDIAN':
      case 'PERCENTILE': {
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        summary[key] = sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];
        break;
      }

      default:
        summary[key] = values.reduce((a, b) => a + b, 0);
        break;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Этап 2: Пересчитываем calculated метрики (формулы)
  //         на агрегированных значениях
  // ═══════════════════════════════════════════════════════════
  if (formulas.size > 0) {
    const recalculated = recalculateFormulasOnAggregated(summary, formulas);
    for (const [key, val] of Object.entries(recalculated)) {
      if (!key.startsWith('__agg_') && !key.startsWith('base_')) {
        summary[key] = val;
      }
    }
  }

  return summary;
}