import type { CompiledQuery, MetricAggregationMeta } from './types';
import { recalculateFormulasOnAggregated } from './post-process';

/**
 * Агрегированная строка итогов.
 *
 * `_record_count` — строго число (сумма записей по всем группам).
 * `COUNT_DISTINCT`, `MEDIAN`, `PERCENTILE` могут быть `null`,
 * т.к. эти функции не являются аддитивными.
 */
export interface AggregatedSummary {
  [key: string]: number | null;
  _record_count: number;
}

/**
 * Умная агрегация строк breakdown в одну сводную строку.
 *
 * Единый источник правды для DuckDB и PostgreSQL engine'ов.
 * Применяет правильную математику для каждого типа агрегации:
 *
 *  - SUM, COUNT → сумма значений (аддитивные)
 *  - AVG → взвешенное среднее через SUM/COUNT
 *  - MAX → глобальный максимум
 *  - MIN → глобальный минимум
 *  - COUNT_DISTINCT → `null` (неаддитивная, требует глобального SQL)
 *  - MEDIAN, PERCENTILE → `null` (неаддитивная)
 *
 * После агрегации пересчитывает calculated-метрики (формулы)
 * на сводных значениях.
 */
export function aggregateProcessedRows(
  processedRows: Record<string, number | null>[],
  aggregateMetadata: Map<string, MetricAggregationMeta>,
  formulas: CompiledQuery['formulas']
): AggregatedSummary {
  if (processedRows.length === 0) {
    return { _record_count: 0 };
  }

  const summary: AggregatedSummary = { _record_count: 0 };
  const keys = Object.keys(processedRows[0]);

  // ═══════════════════════════════════════════════════════════
  // Этап 0: Суммируем _record_count по всем строкам
  // ═══════════════════════════════════════════════════════════
  let totalRecordCount = 0;
  for (const row of processedRows) {
    const rc = row['_record_count'];
    if (typeof rc === 'number' && isFinite(rc)) {
      totalRecordCount += rc;
    } else if (typeof rc === 'bigint') {
      totalRecordCount += Number(rc);
    }
  }
  summary['_record_count'] = totalRecordCount;

  // ═══════════════════════════════════════════════════════════
  // Этап 1: Агрегируем aggregate-метрики по их типу
  // ═══════════════════════════════════════════════════════════
  for (const key of keys) {
    // Пропускаем служебные колонки (они нужны только для AVG)
    if (key.startsWith('__agg_sum__') || key.startsWith('__agg_count__')) {
      summary[key] = null;
      continue;
    }
    // _record_count уже посчитан выше
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
        // Аддитивные функции — можно суммировать по группам
        summary[key] = values.reduce((a, b) => a + b, 0);
        break;

      case 'COUNT_DISTINCT':
        // ⚠️ НЕАДДИТИВНАЯ: sum(distinct) по группам ≠ глобальный distinct.
        // Ставим null — UI покажет '—', а в будущем считаем глобально.
        summary[key] = null;
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
      case 'PERCENTILE':
        // ⚠️ НЕАДДИТИВНАЯ: "медиана медиан" ≠ реальная медиана.
        // Ставим null, чтобы не вводить пользователя в заблуждение.
        summary[key] = null;
        break;

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