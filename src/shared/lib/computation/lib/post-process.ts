import { safeMath } from '@/shared/lib/math/safe-math';
import type { CompiledQuery } from './types';

type CompiledFormula = { evaluate: (scope: Record<string, number>) => unknown };

/**
 * Пост-обработка SQL-результата.
 *
 * Вычисляет calculated-метрики, которые НЕ были скомпилированы в SQL
 * (см. `calculatedInSqlAliases` в CompiledQuery). Для метрик, уже
 * вычисленных в SQL через CTE, берёт готовые значения из строк.
 */
export function postProcessAggregates(
  sqlRows: Record<string, unknown>[],
  compiled: CompiledQuery
): Record<string, number | null>[] {
  if (sqlRows.length === 0) return [];

  const { formulas, calculatedInSqlAliases } = compiled;
  const sortedCalculated = topologicalSort(formulas);

  const compiledFormulas = new Map<string, CompiledFormula>();
  for (const [baseAlias, meta] of formulas.entries()) {
    try {
      compiledFormulas.set(
        baseAlias,
        safeMath.compile(meta.formula) as CompiledFormula
      );
    } catch (error) {
      console.error(
        `[post-process] Formula compilation error for ${baseAlias}:`,
        error
      );
    }
  }

  return sqlRows.map((row) =>
    processRow(row, formulas, compiledFormulas, sortedCalculated, calculatedInSqlAliases)
  );
}

function processRow(
  row: Record<string, unknown>,
  formulas: CompiledQuery['formulas'],
  compiledFormulas: Map<string, CompiledFormula>,
  sortedCalculated: string[],
  calculatedInSqlAliases: Set<string>
): Record<string, number | null> {
  const results: Record<string, number | null> = {};

  // ═══════════════════════════════════════════════════════════
  // Этап 1: Извлекаем AGGREGATE и готовые CALCULATED из SQL
  // ═══════════════════════════════════════════════════════════
  for (const [key, val] of Object.entries(row)) {
    if (key === 'dummy' || key === '_group_label' || key === 'record_count') continue;

    // Пропускаем технические field deps (начинаются с __fb_)
    if (key.startsWith('__fb_')) continue;
    // Пропускаем base_ алиасы (они не должны быть в финальном результате)
    if (key.startsWith('base_')) continue;
    // Пропускаем служебные AVG-колонки
    if (key.startsWith('__agg_sum__') || key.startsWith('__agg_count__')) continue;

    // Формулы-зависимости пропускаем — обработаем ниже
    if (formulas.has(key)) continue;

    const numericVal =
      typeof val === 'number'
        ? val
        : typeof val === 'bigint'
          ? Number(val)
          : null;
    results[key] = numericVal;
  }

  // ═══════════════════════════════════════════════════════════
  // Этап 2: Вычисляем CALCULATED метрики (ТОЛЬКО те, что не в SQL)
  // ═══════════════════════════════════════════════════════════
  for (const baseAlias of sortedCalculated) {
    const meta = formulas.get(baseAlias);
    if (!meta) continue;

    const finalAlias = baseAlias.replace('base_', '');

    // ✅ Если метрика уже вычислена в SQL — берём готовое значение
    if (calculatedInSqlAliases.has(finalAlias)) {
      const sqlVal = row[finalAlias];
      results[finalAlias] =
        typeof sqlVal === 'number'
          ? sqlVal
          : typeof sqlVal === 'bigint'
            ? Number(sqlVal)
            : null;
      continue;
    }

    // ❌ Fallback: вычисляем через Math.js
    try {
      const scope: Record<string, number> = {};

      for (const dep of meta.fieldDependencies) {
        const depAlias = `${baseAlias}__${dep.alias}`;
        const rawVal = row[depAlias];
        scope[dep.alias] =
          typeof rawVal === 'number'
            ? rawVal
            : typeof rawVal === 'bigint'
              ? Number(rawVal)
              : 0;
      }

      for (const dep of meta.metricDependencies) {
        const depValue = findMetricValue(results, dep.metricId, meta.groupId);
        scope[dep.alias] = depValue ?? 0;
      }

      const compiled = compiledFormulas.get(baseAlias);
      if (compiled) {
        const value = compiled.evaluate(scope);
        results[finalAlias] =
          typeof value === 'number' && isFinite(value) ? value : null;
      } else {
        results[finalAlias] = null;
      }
    } catch (err) {
      console.error(`[post-process] Error calculating ${baseAlias}:`, err);
      results[finalAlias] = null;
    }
  }

  return results;
}

function topologicalSort(
  formulas: CompiledQuery['formulas']
): string[] {
  const calculatedAliases = Array.from(formulas.keys());
  const result: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const metricIdToAlias = new Map<string, string>();

  for (const [baseAlias, meta] of formulas.entries()) {
    metricIdToAlias.set(meta.metricId, baseAlias);
  }

  function visit(baseAlias: string): void {
    if (visited.has(baseAlias)) return;
    if (visiting.has(baseAlias)) {
      console.warn(
        `[post-process] Circular dependency detected at ${baseAlias}`
      );
      return;
    }
    visiting.add(baseAlias);
    const meta = formulas.get(baseAlias);
    if (meta) {
      for (const dep of meta.metricDependencies) {
        const depAlias = metricIdToAlias.get(dep.metricId);
        if (depAlias && formulas.has(depAlias)) {
          visit(depAlias);
        }
      }
    }
    visiting.delete(baseAlias);
    visited.add(baseAlias);
    result.push(baseAlias);
  }

  for (const baseAlias of calculatedAliases) visit(baseAlias);
  return result;
}

function findMetricValue(
  results: Record<string, number | null>,
  metricId: string,
  currentGroupId: string
): number | null {
  const exactKey = `${currentGroupId}__${metricId}`;
  if (exactKey in results) return results[exactKey];
  for (const [key, val] of Object.entries(results)) {
    if (key.endsWith(`__${metricId}`)) return val;
  }
  return null;
}

/**
 * Пересчёт calculated-метрик на АГРЕГИРОВАННЫХ значениях (для сводной строки).
 * Используется только в aggregateProcessedRows (сводка breakdown).
 */
export function recalculateFormulasOnAggregated(
  aggregatedRow: Record<string, number | null>,
  formulas: CompiledQuery['formulas']
): Record<string, number | null> {
  const sortedCalculated = topologicalSort(formulas);
  const result = { ...aggregatedRow };
  const compiledFormulas = new Map<string, CompiledFormula>();

  for (const [baseAlias, meta] of formulas.entries()) {
    try {
      compiledFormulas.set(
        baseAlias,
        safeMath.compile(meta.formula) as CompiledFormula
      );
    } catch {
      // skip
    }
  }

  for (const baseAlias of sortedCalculated) {
    const meta = formulas.get(baseAlias);
    if (!meta) continue;
    try {
      const scope: Record<string, number> = {};
      for (const dep of meta.fieldDependencies) {
        const depAlias = `${baseAlias}__${dep.alias}`;
        scope[dep.alias] = result[depAlias] ?? 0;
      }
      for (const dep of meta.metricDependencies) {
        const depValue = findMetricValue(result, dep.metricId, meta.groupId);
        scope[dep.alias] = depValue ?? 0;
      }
      const compiled = compiledFormulas.get(baseAlias);
      if (compiled) {
        const value = compiled.evaluate(scope);
        result[baseAlias.replace('base_', '')] =
          typeof value === 'number' && isFinite(value) ? value : null;
      }
    } catch {
      result[baseAlias.replace('base_', '')] = null;
    }
  }
  return result;
}