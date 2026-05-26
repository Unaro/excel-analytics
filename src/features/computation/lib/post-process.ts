import { safeMath } from '@/shared/lib/math/safe-math';
import type { CompiledQuery } from './types';

/**
 * Пост-обработка SQL-результата.
 * 
 * Алгоритм:
 * 1. Извлекаем значения всех AGGREGATE метрик из SQL rows (они уже посчитаны)
 * 2. Топологически сортируем CALCULATED метрики (чтобы учесть зависимости)
 * 3. Для каждой calculated собираем scope из двух источников:
 *    - fieldDependencies → из SQL (базовые агрегаты колонок)
 *    - metricDependencies → из уже вычисленных метрик
 * 4. Вычисляем формулу через mathjs
 */
export function postProcessAggregates(
  sqlRows: Record<string, unknown>[],
  formulas: CompiledQuery['formulas']
): Record<string, number | null> {
  const results: Record<string, number | null> = {};
  const row = sqlRows[0] || {};

  // ═══════════════════════════════════════════════════════════
  // 1. Извлекаем AGGREGATE значения из SQL
  //    Все ключи из row, кроме 'dummy' и ключей формул — это агрегаты
  // ═══════════════════════════════════════════════════════════
  for (const [key, val] of Object.entries(row)) {
    if (key === 'dummy') continue;
    if (key.startsWith('base_')) continue;
    if (formulas.has(key)) continue;
    results[key] = typeof val === 'number' ? val : (typeof val === 'bigint' ? Number(val) : null);
  }

  // ═══════════════════════════════════════════════════════════
  // 2. Топологическая сортировка CALCULATED метрик
  // ═══════════════════════════════════════════════════════════
  const sortedCalculated = topologicalSort(formulas);

  // ═══════════════════════════════════════════════════════════
  // 3. Вычисляем CALCULATED метрики по порядку
  // ═══════════════════════════════════════════════════════════
  for (const baseAlias of sortedCalculated) {
    const meta = formulas.get(baseAlias);
    if (!meta) continue;

    try {
      const scope: Record<string, number> = {};

      for (const dep of meta.fieldDependencies) {
        const depAlias = `${baseAlias}__${dep.alias}`;
        const rawVal = (row as Record<string, unknown>)[depAlias];
        scope[dep.alias] = typeof rawVal === 'number' ? rawVal : 
                           (typeof rawVal === 'bigint' ? Number(rawVal) : 0);
      }

      for (const dep of meta.metricDependencies) {
        const depValue = findMetricValue(results, dep.metricId, meta.groupId);
        scope[dep.alias] = depValue ?? 0;
      }

      const value = safeEvaluateFormula(meta.formula, scope);
      results[baseAlias.replace('base_', '')] = value;
    } catch (err) {
      console.error(`[post-process] Error calculating ${baseAlias}:`, err);
      results[baseAlias.replace('base_', '')] = null;
    }
  }

  return results;
}

/**
 * Топологическая сортировка calculated метрик по их metric-зависимостям.
 * Обнаруживает циклы и возвращает валидный порядок вычислений.
 */
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

/**
 * Ищет значение метрики по её ID в уже вычисленных результатах.
 * В results ключи имеют формат "groupId__metricId".
 */
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
 * Безопасное вычисление формулы через mathjs с именованными переменными.
 */
function safeEvaluateFormula(
  formula: string,
  scope: Record<string, number>
): number | null {
  try {
    const result = safeMath.evaluate(formula, scope);
    if (typeof result === 'number' && isFinite(result)) return result;
    return null;
  } catch (err) {
    console.error(`[post-process] Formula "${formula}" failed with scope`, scope, err);
    return null;
  }
}