// lib/utils/formula.ts
import { parse, MathNode } from 'mathjs';

interface MathSymbolNode extends MathNode {
  name: string;
}

interface MathFunctionNode extends MathNode {
  fn: MathNode;
  args: MathNode[];
}

/**
 * Константы mathjs, не являющиеся переменными пользователя.
 * Имена функций исключаются отдельно (по FunctionNode.fn), а не списком.
 */
const MATH_CONSTANTS = new Set(['pi', 'e']);

/**
 * Извлекает список переменных из формулы.
 *
 * Имена функций (в т.ч. `MAX`, `SUM`, `round`) — это `FunctionNode.fn`,
 * а НЕ переменные: они собираются отдельно и исключаются из результата
 * независимо от регистра. Раньше список встроенных был захардкожен
 * строчными буквами, и `MAX(a)` ошибочно давал переменные `["MAX","a"]`.
 *
 * Пример: `(MAX(a)/SUM(a)) - MIN(b)` -> `["a", "b"]`.
 */
export function extractVariables(formula: string): string[] {
  if (!formula || !formula.trim()) return [];

  try {
    const node = parse(formula);

    // Шаг 1: собрать имена вызываемых функций (их fn-символы — не переменные)
    const functionNames = new Set<string>();
    node.traverse((n: MathNode) => {
      if (n.type === 'FunctionNode') {
        const fn = (n as unknown as MathFunctionNode).fn;
        if (fn?.type === 'SymbolNode') {
          functionNames.add((fn as unknown as MathSymbolNode).name);
        }
      }
    });

    // Шаг 2: переменные = SymbolNode, не являющиеся именем функции или константой
    const foundDeps = new Set<string>();
    node.traverse((n: MathNode) => {
      if (n.type !== 'SymbolNode') return;
      const name = (n as unknown as MathSymbolNode).name;
      if (typeof name !== 'string') return;
      if (functionNames.has(name) || MATH_CONSTANTS.has(name)) return;
      foundDeps.add(name);
    });

    return Array.from(foundDeps);
  } catch {
    // Незавершённая формула при наборе (напр. «a/b*») — нормальное промежуточное
    // состояние, не ошибка. Тихо возвращаем пустой список переменных.
    return [];
  }
}