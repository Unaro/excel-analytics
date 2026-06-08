import type { CompiledQuery, MetricAggregationMeta } from './types';
import { recalculateFormulasOnAggregated } from './post-process';

/**
 * Агрегированная строка итогов.
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
 *
 * Применяет правильную математику для каждого типа:
 *   - SUM, COUNT → сумма значений (аддитивные)
 *   - AVG → взвешенное среднее через SUM/COUNT
 *   - MAX → глобальный максимум
 *   - MIN → глобальный минимум
 *   - COUNT_DISTINCT → `null` (неаддитивная, требует глобального SQL)
 *   - MEDIAN, PERCENTILE → `null` (неаддитивная)
 *   - CALCULATED (формулы) → `null`, затем пересчёт через
 *     `recalculateFormulasOnAggregated` из агрегированных field dependencies.
 *     Это гарантирует, что `(SUM(a) / SUM(b)) * 100` даст правильный результат,
 *     а не `SUM(a/b) * 100` (что было бы математически неверно).
 *
 * После агрегации пересчитывает calculated-метрики на сводных значениях.
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
  // Подготовительный этап: собираем метаданные о calculated метриках
  //
  // Для корректной агрегации формул вроде (a/b)*100 нужно:
  //   1. Просуммировать field dependencies (a, b) по всем строкам
  //   2. Пересчитать формулу из агрегированных значений
  //
  // fieldDependencyAliases — технические алиасы вида "base_groupId__metricId__varName",
  // которые SQL возвращает как уже агрегированные значения (SUM по подгруппе).
  //
  // calculatedFinalAliases — финальные алиасы calculated метрик (без "base_"),
  // которые НЕЛЬЗЯ просто суммировать.
  // ═══════════════════════════════════════════════════════════
  const fieldDependencyAliases = new Set<string>();
  const calculatedFinalAliases = new Set<string>();

  for (const [baseAlias, meta] of formulas.entries()) {
    const finalAlias = baseAlias.replace('base_', '');
    calculatedFinalAliases.add(finalAlias);

    for (const dep of meta.fieldDependencies) {
      const depAlias = `${baseAlias}__${dep.alias}`;
      fieldDependencyAliases.add(depAlias);
    }
  }

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
  // Этап 1: Агрегируем колонки по их типу
  // ═══════════════════════════════════════════════════════════
  for (const key of keys) {
    // Пропускаем служебные колонки для AVG
    if (key.startsWith('__agg_sum__') || key.startsWith('__agg_count__')) {
      summary[key] = null;
      continue;
    }

    // _record_count уже посчитан выше
    if (key === '_group_label' || key === '_record_count') continue;

    // ─── Поле-зависимость calculated метрики → SUM ─────────
    // Это уже агрегаты из SQL (SUM по подгруппе).
    // Для итоговой строки их нужно просто просуммировать.
    if (fieldDependencyAliases.has(key)) {
      const values = processedRows
        .map(row => row[key])
        .filter((v): v is number => typeof v === 'number' && isFinite(v));

      summary[key] = values.length > 0
        ? values.reduce((a, b) => a + b, 0)
        : null;
      continue;
    }

    // ─── Calculated метрика (финальный алиас) → null ───────
    if (calculatedFinalAliases.has(key)) {
      summary[key] = null;
      continue;
    }

    // ─── Aggregate метрика → по типу агрегации ─────────────
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
        summary[key] = null;
        break;

      default:
        summary[key] = values.reduce((a, b) => a + b, 0);
        break;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Этап 2: Пересчитываем calculated метрики (формулы)
  //         на агрегированных значениях field dependencies.
  //
  // Теперь в summary лежат правильные SUM(a) и SUM(b),
  // и формула (a/b)*100 даст корректный итоговый результат.
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