// shared/lib/computation/lib/aggregate-formula.ts
// ─────────────────────────────────────────────────────────────
// Препроцессор формул с агрегатными функциями.
//
// Превращает формулу с агрегатами над колонками — MAX(a)/SUM(b) — в
// формулу над пред-агрегированными псевдо-переменными (a__MAX, b__SUM)
// + список field-зависимостей с агрегатом на каждую. Дальше работает
// существующий пайплайн (base-CTE агрегирует, formula-to-sql считает
// по псевдо-переменным, aggregation.ts переагрегирует «Итого»).
//
// Зачем: раньше каждая переменная calculated-формулы агрегировалась
// захардкоженным SUM. Теперь агрегат задаётся в формуле; голая колонка
// авто-оборачивается в дефолтный агрегат (или запрещается настройкой).
// ─────────────────────────────────────────────────────────────

import { parse, SymbolNode, type MathNode } from 'mathjs';
import type { AggregateFormulaOptions } from './types';

export type { AggregateFormulaOptions };

/** Агрегатные функции, распознаваемые в формулах. */
export const AGGREGATE_FUNCTIONS = [
  'SUM', 'AVG', 'MIN', 'MAX', 'COUNT', 'COUNT_DISTINCT', 'MEDIAN',
] as const;
export type AggregateFn = (typeof AGGREGATE_FUNCTIONS)[number];

const AGGREGATE_SET = new Set<string>(AGGREGATE_FUNCTIONS);

function isAggregateName(name: string): boolean {
  return AGGREGATE_SET.has(name.toUpperCase());
}

export interface FormulaFieldDep {
  /** Псевдо-переменная в переписанной формуле (например, a__MAX). */
  alias: string;
  columnName: string;
  aggregateFn: string;
}

export const DEFAULT_AGGREGATE_OPTIONS: AggregateFormulaOptions = {
  defaultAggregate: 'SUM',
  requireExplicit: false,
};

export type PreprocessResult =
  | { success: true; formula: string; fieldDependencies: FormulaFieldDep[] }
  | { success: false; error: string };

interface SymbolShape { name: string }
interface FunctionShape { fn: MathNode; args: MathNode[] }

/**
 * Готовит формулу с агрегатами к компиляции существующим пайплайном.
 *
 * @param formula      исходная формула, например `(MAX(a)/SUM(a)) - MIN(b)`
 * @param fieldBindings алиас переменной → колонка датасета
 * @param metricAliases алиасы ссылок на другие метрики (не агрегируются)
 * @param options      дефолтный агрегат и режим запрета голых колонок
 */
export function preprocessAggregateFormula(
  formula: string,
  fieldBindings: Map<string, string>,
  metricAliases: Set<string>,
  options: AggregateFormulaOptions = DEFAULT_AGGREGATE_OPTIONS
): PreprocessResult {
  if (!formula || !formula.trim()) {
    return { success: true, formula: '', fieldDependencies: [] };
  }

  let root: MathNode;
  try {
    root = parse(formula);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Ошибка разбора формулы' };
  }

  // ── Валидация: вложенные агрегаты и форма аргумента ──
  const validationError = validate(root, fieldBindings, metricAliases);
  if (validationError) return { success: false, error: validationError };

  const deps = new Map<string, FormulaFieldDep>();
  const upsertDep = (columnName: string, fn: string): string => {
    const aggregateFn = fn.toUpperCase();
    const alias = `${columnName}__${aggregateFn}`;
    if (!deps.has(alias)) deps.set(alias, { alias, columnName, aggregateFn });
    return alias;
  };

  let transformError: string | null = null;

  const rewritten = root.transform((node: MathNode): MathNode => {
    // Агрегат над одной field-переменной → псевдо-переменная-зависимость
    if (node.type === 'FunctionNode') {
      const fnNode = node as unknown as FunctionShape;
      if (fnNode.fn.type === 'SymbolNode') {
        const name = (fnNode.fn as unknown as SymbolShape).name;
        if (isAggregateName(name)) {
          const arg = fnNode.args[0];
          const column = fieldBindings.get((arg as unknown as SymbolShape).name);
          // column гарантированно есть (проверено в validate)
          const alias = upsertDep(column as string, name);
          return new SymbolNode(alias);
        }
      }
      return node; // скалярная функция (round/abs/…) — оставляем
    }

    // Голая колонка вне агрегата → авто-обёртка или запрет
    if (node.type === 'SymbolNode') {
      const name = (node as unknown as SymbolShape).name;
      const column = fieldBindings.get(name);
      if (column !== undefined) {
        if (options.requireExplicit) {
          transformError =
            `Колонка «${name}» должна быть внутри агрегатной функции ` +
            `(например, ${options.defaultAggregate}(${name})).`;
          return node;
        }
        const alias = upsertDep(column, options.defaultAggregate);
        return new SymbolNode(alias);
      }
      // метрика / константа / имя функции — без изменений
      return node;
    }

    return node;
  });

  if (transformError) return { success: false, error: transformError };

  return {
    success: true,
    formula: rewritten.toString(),
    fieldDependencies: Array.from(deps.values()),
  };
}

/**
 * Проверяет ограничения Фазы A: агрегат применяется к ОДНОЙ field-переменной,
 * без вложенных агрегатов, не к метрике/выражению.
 */
function validate(
  root: MathNode,
  fieldBindings: Map<string, string>,
  metricAliases: Set<string>
): string | null {
  let error: string | null = null;
  const aggregateStack: string[] = [];

  const walk = (node: MathNode): void => {
    if (error) return;

    if (node.type === 'FunctionNode') {
      const fnNode = node as unknown as FunctionShape;
      const isAgg =
        fnNode.fn.type === 'SymbolNode' &&
        isAggregateName((fnNode.fn as unknown as SymbolShape).name);

      if (isAgg) {
        const fnName = (fnNode.fn as unknown as SymbolShape).name.toUpperCase();

        if (aggregateStack.length > 0) {
          error = `Вложенные агрегаты не поддерживаются: ${aggregateStack[0]}(… ${fnName}(…) …).`;
          return;
        }
        if (fnNode.args.length !== 1) {
          error = `Агрегат ${fnName} принимает ровно одну переменную.`;
          return;
        }
        const arg = fnNode.args[0];
        if (arg.type !== 'SymbolNode') {
          error = `Агрегат ${fnName} можно применять только к переменной-колонке, не к выражению.`;
          return;
        }
        const argName = (arg as unknown as SymbolShape).name;
        if (metricAliases.has(argName)) {
          error = `Агрегат ${fnName} нельзя применять к метрике «${argName}» — она уже агрегирована.`;
          return;
        }
        if (!fieldBindings.has(argName)) {
          error = `Переменная «${argName}» в ${fnName}(${argName}) не привязана к колонке.`;
          return;
        }

        aggregateStack.push(fnName);
        fnNode.args.forEach(walk);
        aggregateStack.pop();
        return;
      }
    }

    // обход детей для остальных узлов
    node.forEach((child: MathNode) => walk(child));
  };

  walk(root);
  return error;
}
