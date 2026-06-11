import type { CompiledQuery, MetricAggregationMeta } from './types';
import { recalculateFormulasOnAggregated } from './post-process';
import { FIELD_DEP_PREFIX } from './query-compiler';

export interface AggregatedSummary {
  [key: string]: number | null;
  _record_count: number;
}

/**
 * Переагрегирует построчные результаты group-by в сводную строку «Итого»:
 * SUM/COUNT суммируются, AVG взвешивается через __agg_sum__/__agg_count__,
 * MIN/MAX берут экстремум, COUNT_DISTINCT/MEDIAN непереагрегируемы (null),
 * calculated-формулы пересчитываются на агрегированных зависимостях.
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
  // Подготовительный этап: собираем метаданные
  // ═══════════════════════════════════════════════════════════
  const fieldDependencyAliases = new Set<string>();
  const calculatedFinalAliases = new Set<string>();

  for (const [baseAlias, meta] of formulas.entries()) {
    const finalAlias = baseAlias.replace('base_', '');
    calculatedFinalAliases.add(finalAlias);

    for (const dep of meta.fieldDependencies) {
      const depAlias = `${FIELD_DEP_PREFIX}${meta.groupId}_${meta.metricId}_${dep.alias}`;
      fieldDependencyAliases.add(depAlias);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Этап 0: Суммируем _record_count
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
  // Этап 1: Агрегируем колонки
  // ═══════════════════════════════════════════════════════════
  for (const key of keys) {
    if (key.startsWith('__agg_sum__') || key.startsWith('__agg_count__')) {
      summary[key] = null;
      continue;
    }

    if (key === '_group_label' || key === '_record_count') continue;

    // ─── Field dependency → SUM ─────────────────────────────
    if (fieldDependencyAliases.has(key)) {
      const values = processedRows
        .map(row => row[key])
        .filter((v): v is number => typeof v === 'number' && isFinite(v));

      summary[key] = values.length > 0
        ? values.reduce((a, b) => a + b, 0)
        : null;
      continue;
    }

    // ─── Calculated (финальный алиас) → null ────────────────
    if (calculatedFinalAliases.has(key)) {
      summary[key] = null;
      continue;
    }

    // ─── Aggregate метрика → по типу ────────────────────────
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
        summary[key] = values.reduce((a, b) => a + b, 0);
        break;

      case 'COUNT_DISTINCT':
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
        summary[key] = null;
        break;

      default:
        summary[key] = values.reduce((a, b) => a + b, 0);
        break;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Этап 2: Пересчитываем calculated метрики
  // ═══════════════════════════════════════════════════════════
  if (formulas.size > 0) {
    const recalculated = recalculateFormulasOnAggregated(summary, formulas);
    for (const [key, val] of Object.entries(recalculated)) {
      if (!key.startsWith('__agg') && !key.startsWith('base_')) {
        summary[key] = val;
      }
    }
  }

  return summary;
}