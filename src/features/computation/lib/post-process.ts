import { safeMath } from '@/shared/lib/math/safe-math';
import type { CompiledQuery } from './types';

type CompiledFormula = { evaluate: (scope: Record<string, number>) => unknown };

/**
 * Пост-обработка SQL-результата.
 * Поддерживает режимы с GROUP BY (массив строк) и без него.
 */
export function postProcessAggregates(
  sqlRows: Record<string, unknown>[],
  formulas: CompiledQuery['formulas']
): Record<string, number | null>[] {
  if (sqlRows.length === 0) return [];

  const sortedCalculated = topologicalSort(formulas);

  const compiledFormulas = new Map<string, CompiledFormula>();
  for (const [baseAlias, meta] of formulas.entries()) {
    try {
      compiledFormulas.set(baseAlias, safeMath.compile(meta.formula) as CompiledFormula);
    } catch (error) {
      console.error(`[post-process] Formula compilation error for ${baseAlias}:`, error);
    }
  }

  return sqlRows.map(row => processRow(row, formulas, compiledFormulas, sortedCalculated));
}

function processRow(
  row: Record<string, unknown>,
  formulas: CompiledQuery['formulas'],
  compiledFormulas: Map<string, CompiledFormula>,
  sortedCalculated: string[]
): Record<string, number | null> {
  const results: Record<string, number | null> = {};

  // ═══════════════════════════════════════════════════════════
  // Извлекаем AGGREGATE значения из SQL
  // ═══════════════════════════════════════════════════════════
  for (const [key, val] of Object.entries(row)) {
    if (key === 'dummy' || key === '_group_label' || key === '_record_count') continue;
    if (key.startsWith('base_')) continue;
    if (formulas.has(key)) continue;

    const numericVal = typeof val === 'number' ? val : (typeof val === 'bigint' ? Number(val) : null);
    results[key] = numericVal;

    if (key.startsWith('__agg_sum__') || key.startsWith('__agg_count__')) {
      results[key] = numericVal;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Вычисляем CALCULATED метрики по уже отсортированному порядку
  // ═══════════════════════════════════════════════════════════
  for (const baseAlias of sortedCalculated) {
    const meta = formulas.get(baseAlias);
    if (!meta) continue;

    try {
      const scope: Record<string, number> = {};

      for (const dep of meta.fieldDependencies) {
        const depAlias = `${baseAlias}__${dep.alias}`;
        const rawVal = row[depAlias];
        scope[dep.alias] = typeof rawVal === 'number' ? rawVal :
          (typeof rawVal === 'bigint' ? Number(rawVal) : 0);
      }

      for (const dep of meta.metricDependencies) {
        const depValue = findMetricValue(results, dep.metricId, meta.groupId);
        scope[dep.alias] = depValue ?? 0;
      }

      const compiled = compiledFormulas.get(baseAlias);
      if (compiled) {
        const value = compiled.evaluate(scope);
        results[baseAlias.replace('base_', '')] = typeof value === 'number' && isFinite(value) ? value : null;
      } else {
        results[baseAlias.replace('base_', '')] = null;
      }
    } catch (err) {
      console.error(`[post-process] Error calculating ${baseAlias}:`, err);
      results[baseAlias.replace('base_', '')] = null;
    }
  }

  return results;
}

function topologicalSort(formulas: CompiledQuery['formulas']): string[] {
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
      console.warn(`[post-process] Circular dependency detected at ${baseAlias}`);
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

  for (const baseAlias of calculatedAliases) {
    visit(baseAlias);
  }

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

// ═══════════════════════════════════════════════════════════
// пересчёт calculated метрик на уже агрегированных значениях
// ═══════════════════════════════════════════════════════════
export function recalculateFormulasOnAggregated(
  aggregatedRow: Record<string, number | null>,
  formulas: CompiledQuery['formulas']
): Record<string, number | null> {
  const sortedCalculated = topologicalSort(formulas);
  const result = { ...aggregatedRow };

  const compiledFormulas = new Map<string, CompiledFormula>();
  for (const [baseAlias, meta] of formulas.entries()) {
    try {
      compiledFormulas.set(baseAlias, safeMath.compile(meta.formula) as CompiledFormula);
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
        result[baseAlias.replace('base_', '')] = typeof value === 'number' && isFinite(value) ? value : null;
      }
    } catch {
      result[baseAlias.replace('base_', '')] = null;
    }
  }

  return result;
}