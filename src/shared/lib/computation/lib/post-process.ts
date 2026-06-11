import { logger } from '@/shared/lib/logger';
import { safeMath } from '@/shared/lib/math/safe-math';
import type { CompiledQuery } from './types';
import { FIELD_DEP_PREFIX } from './query-compiler';

// ─────────────────────────────────────────────────────────────
// Типизация скомпилированных формул
//
// mathjs.compile() имеет две перегрузки:
//   compile(expr: string):    EvalFunction       ← одиночная формула
//   compile(exprs: string[]): EvalFunction[]     ← массив формул
//
// ─────────────────────────────────────────────────────────────

/** Структурный контракт скомпилированной формулы mathjs. */
interface CompiledFormula {
  evaluate: (scope: Record<string, number>) => unknown;
}

/**
 * Компилирует строковую формулу в исполняемый объект mathjs.
 *
 * Изолирует приведение типа в одной точке — все вызовы ниже
 * получают строго типизированный CompiledFormula без кастов.
 *
 * @throws Error если формула содержит синтаксическую ошибку
 */
function compileFormula(formula: string): CompiledFormula {
  return safeMath.compile(formula) as CompiledFormula;
}

// ─────────────────────────────────────────────────────────────
// Пост-обработка SQL-результата
// ─────────────────────────────────────────────────────────────

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
      compiledFormulas.set(baseAlias, compileFormula(meta.formula));
    } catch (error) {
      logger.error(
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

  // Этап 1: Извлекаем значения из SQL
  for (const [key, val] of Object.entries(row)) {
    if (key === 'dummy' || key === '_group_label' || key === 'record_count') continue;
    if (key.startsWith('__agg_sum__') || key.startsWith('__agg_count__')) continue;

    if (formulas.has(key)) continue;

    const numericVal =
      typeof val === 'number'
        ? val
        : typeof val === 'bigint'
          ? Number(val)
          : null;
    results[key] = numericVal;
  }

  // Этап 2: Вычисляем calculated метрики
  for (const baseAlias of sortedCalculated) {
    const meta = formulas.get(baseAlias);
    if (!meta) continue;
    const finalAlias = baseAlias.replace('base_', '');

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

    try {
      const scope: Record<string, number> = {};

      for (const dep of meta.fieldDependencies) {
        const depAlias = `${FIELD_DEP_PREFIX}${meta.groupId}_${meta.metricId}_${dep.alias}`;
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
      logger.error(`[post-process] Error calculating ${baseAlias}:`, err);
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
      logger.warn(
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

// ─────────────────────────────────────────────────────────────
// Пересчёт calculated-метрик на агрегированных значениях
// ─────────────────────────────────────────────────────────────

/**
 * Пересчёт calculated-метрик на АГРЕГИРОВАННЫХ значениях (для сводной строки).
 */
export function recalculateFormulasOnAggregated(
  aggregatedRow: Record<string, number | null>,
  formulas: CompiledQuery['formulas']
): Record<string, number | null> {
  const sortedCalculated = topologicalSort(formulas);
  const result = { ...aggregatedRow };

  logger.debug(
    '[recalc-summary] input keys:',
    Object.keys(result).filter(k => !k.startsWith('_'))
  );

  const compiledFormulas = new Map<string, CompiledFormula>();
  for (const [baseAlias, meta] of formulas.entries()) {
    try {
      compiledFormulas.set(
        baseAlias,
        safeMath.compile(meta.formula) as CompiledFormula
      );
    } catch (err) {
      logger.error(`[recalc-summary] compile failed for ${baseAlias}:`, err);
    }
  }

  for (const baseAlias of sortedCalculated) {
    const meta = formulas.get(baseAlias);
    if (!meta) continue;
    try {
      const scope: Record<string, number> = {};

      for (const dep of meta.fieldDependencies) {
        const depAlias = `${FIELD_DEP_PREFIX}${meta.groupId}_${meta.metricId}_${dep.alias}`;
        scope[dep.alias] = result[depAlias] ?? 0;
      }

      for (const dep of meta.metricDependencies) {
        const depValue = findMetricValue(result, dep.metricId, meta.groupId);
        scope[dep.alias] = depValue ?? 0;
      }

      logger.debug(`[recalc-summary] ${baseAlias}:`, { scope, deps: meta.fieldDependencies.length + meta.metricDependencies.length });

      const compiled = compiledFormulas.get(baseAlias);
      if (compiled) {
        const value = compiled.evaluate(scope);
        result[baseAlias.replace('base_', '')] =
          typeof value === 'number' && isFinite(value) ? value : null;
      }
    } catch (err) {
      logger.error(`[recalc-summary] error for ${baseAlias}:`, err);
      result[baseAlias.replace('base_', '')] = null;
    }
  }

  logger.debug('[recalc-summary] output:', Object.fromEntries(
    Object.entries(result).filter(([k]) => !k.startsWith('_'))
  ));

  return result;
}