import { safeMath } from '@/shared/lib/math/safe-math';
import type { CompiledQuery } from './types';

export function postProcessAggregates(
  sqlRows: Record<string, unknown>[],
  formulas: CompiledQuery['formulas']
): Record<string, number | null> {
  const results: Record<string, number | null> = {};

  // 1. Предкомпиляция формул: парсим AST один раз до начала обхода строк
  const compiledFormulas = new Map<string, math.EvalFunction>();
  for (const [baseAlias, { formula }] of formulas.entries()) {
    if (formula) {
      try {
        compiledFormulas.set(baseAlias, safeMath.compile(formula));
      } catch (error) {
        console.error(`Ошибка компиляции формулы для ${baseAlias}:`, error);
      }
    }
  }

  // 2. Итерация по строкам (теперь только быстрое выполнение .evaluate)
  for (const row of sqlRows) {
    for (const [baseAlias, meta] of formulas.entries()) {
      const compiled = compiledFormulas.get(baseAlias);
      if (compiled) {
        try {
          const scope: Record<string, number> = {};
          for (const dep of meta.dependencies) {
            const depAlias = `${baseAlias}__${dep.alias}`;
            const rawVal = (row as Record<string, unknown>)[depAlias];
            scope[dep.alias] = typeof rawVal === 'number' ? rawVal : 0;
          }
          results[baseAlias.replace('base_', '')] = compiled.evaluate(scope);
        } catch {
          results[baseAlias.replace('base_', '')] = null;
        }
      } else {
        results[baseAlias.replace('base_', '')] = null;
      }
    }
    
    // Копируем сырые агрегаты без изменений
    for (const [key, val] of Object.entries(row)) {
      if (!formulas.has(key) && key !== 'dummy') {
        results[key] = typeof val === 'number' ? val : null;
      }
    }
  }
  return results;
}