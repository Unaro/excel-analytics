import { parse, MathNode } from 'mathjs';
import type { ComputeDialect } from './types';

// ─────────────────────────────────────────────────────────────
// Структурные контракты AST-нод mathjs.
//
// Диспетчеризация идёт по строковому полю `node.type` (стабильная
// часть API mathjs), а НЕ по instanceof: классы нод ломаются при
// минификации и не гарантированы между версиями библиотеки.
// Интерфейсы ниже описывают только используемые поля.
// ─────────────────────────────────────────────────────────────

interface ConstantNodeShape {
  value: unknown;
}

interface SymbolNodeShape {
  name: string;
}

interface OperatorNodeShape {
  op: string;
  fn: string;
  args: MathNode[];
}

interface FunctionNodeShape {
  fn: MathNode;
  args: MathNode[];
}

interface ParenthesisNodeShape {
  content: MathNode;
}

interface ConditionalNodeShape {
  condition: MathNode;
  trueExpr: MathNode;
  falseExpr: MathNode;
}

// ─────────────────────────────────────────────────────────────
// Публичные типы
// ─────────────────────────────────────────────────────────────
export interface FormulaToSqlContext {
  fieldAliases: Map<string, string>;
  metricAliases: Map<string, string>;
  dialect: ComputeDialect;
}

export interface FormulaToSqlSuccess {
  success: true;
  sql: string;
}

export interface FormulaToSqlFailure {
  success: false;
  reason: string;
}

export type FormulaToSqlResult = FormulaToSqlSuccess | FormulaToSqlFailure;

// ─────────────────────────────────────────────────────────────
// Маппинг бинарных операторов
// ─────────────────────────────────────────────────────────────
const BINARY_OPERATOR_MAP: Record<string, string> = {
  '+': '+',
  '-': '-',
  '*': '*',
  '/': '/',
  '%': '%',
  '==': '=',
  '!=': '<>',
  unequal: '<>',
  '<': '<',
  '>': '>',
  '<=': '<=',
  '>=': '>=',
  and: 'AND',
  or: 'OR',
};

// ─────────────────────────────────────────────────────────────
// Маппинг функций mathjs → SQL
// ─────────────────────────────────────────────────────────────
type FunctionHandler = (args: string[], dialect: ComputeDialect) => string;

const FUNCTION_HANDLERS: Record<string, FunctionHandler> = {
  add: (args) => `(${args.join(' + ')})`,
  subtract: (args) => `(${args[0]} - ${args[1]})`,
  multiply: (args) => `(${args.join(' * ')})`,
  divide: (args) => `(${args[0]} / NULLIF(${args[1]}, 0))`,
  mod: (args) => `MOD(${args[0]}, ${args[1]})`,
  pow: (args) => `POWER(${args[0]}, ${args[1]})`,
  sqrt: (args) => `SQRT(${args[0]})`,
  abs: (args) => `ABS(${args[0]})`,
  sign: (args) => `SIGN(${args[0]})`,
  round: (args) =>
    args.length === 2 ? `ROUND(${args[0]}, ${args[1]})` : `ROUND(${args[0]})`,
  floor: (args) => `FLOOR(${args[0]})`,
  ceil: (args) => `CEIL(${args[0]})`,
  exp: (args) => `EXP(${args[0]})`,
  log: (args) =>
    args.length === 2
      ? `(LN(${args[0]}) / NULLIF(LN(${args[1]}), 0))`
      : `LN(${args[0]})`,
  log10: (args, dialect) =>
    dialect === 'postgres' ? `LOG(${args[0]})` : `LOG10(${args[0]})`,
  min: (args) => `LEAST(${args.join(', ')})`,
  max: (args) => `GREATEST(${args.join(', ')})`,
  if: (args) => `CASE WHEN ${args[0]} THEN ${args[1]} ELSE ${args[2]} END`,
  equal: (args) => `(${args[0]} = ${args[1]})`,
  smaller: (args) => `(${args[0]} < ${args[1]})`,
  larger: (args) => `(${args[0]} > ${args[1]})`,
  smallerEq: (args) => `(${args[0]} <= ${args[1]})`,
  largerEq: (args) => `(${args[0]} >= ${args[1]})`,
};

// ─────────────────────────────────────────────────────────────
// Type Guards для AST-нод
// ─────────────────────────────────────────────────────────────

/**
 * Проверяет, что значение является допустимой SQL-константой.
 * После проверки TypeScript сужает тип до union конкретных типов.
 */
function isValidSqlConstant(
  value: unknown
): value is string | number | boolean | null | undefined {
  if (value === null || value === undefined) return true;
  const t = typeof value;
  return t === 'string' || t === 'number' || t === 'boolean';
}

/**
 * Проверяет, что fn в FunctionNode — это статический символ (имя функции).
 * mathjs допускает dynamic calls (fn как expression), но SQL их не поддерживает.
 */
function isStaticFunctionCall(
  fn: MathNode
): fn is MathNode & SymbolNodeShape {
  return (
    fn.type === 'SymbolNode' &&
    typeof (fn as unknown as SymbolNodeShape).name === 'string'
  );
}

// ─────────────────────────────────────────────────────────────
// Основной класс-компилятор
// ─────────────────────────────────────────────────────────────
export class FormulaToSqlCompiler {
  constructor(private readonly ctx: FormulaToSqlContext) {}

  compile(formula: string): FormulaToSqlResult {
    try {
      const node = parse(formula);
      const sql = this.visit(node);
      return { success: true, sql };
    } catch (err) {
      return {
        success: false,
        reason: err instanceof Error ? err.message : 'Unknown parse error',
      };
    }
  }

  // ─── Dispatcher ───────────────────────────────────────────
  // Диспетчеризация по node.type (строковый дискриминатор mathjs):
  // устойчиво к минификации и смене версии библиотеки, в отличие
  // от instanceof. Один неопознанный узел раньше ронял ВСЕ
  // calculated-метрики в медленный mathjs-fallback (п.12 аудита).
  private visit(node: MathNode): string {
    switch (node.type) {
      case 'ConstantNode':
        return this.visitConstant((node as unknown as ConstantNodeShape).value);
      case 'SymbolNode':
        return this.visitSymbol((node as unknown as SymbolNodeShape).name);
      case 'OperatorNode': {
        const op = node as unknown as OperatorNodeShape;
        return this.visitOperator(op.op, op.fn, op.args);
      }
      case 'FunctionNode': {
        const fn = node as unknown as FunctionNodeShape;
        return this.visitFunction(fn.fn, fn.args);
      }
      case 'ParenthesisNode':
        return `(${this.visit((node as unknown as ParenthesisNodeShape).content)})`;
      case 'ConditionalNode': {
        const cond = node as unknown as ConditionalNodeShape;
        return this.visitConditional(cond.condition, cond.trueExpr, cond.falseExpr);
      }
      default:
        throw new Error(`Unsupported AST node type: "${node.type}"`);
    }
  }

  // ─── Constants ────────────────────────────────────────────
  private visitConstant(value: unknown): string {
    if (!isValidSqlConstant(value)) {
      throw new Error(`Unsupported constant type: ${typeof value}`);
    }
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'number') {
      if (!isFinite(value)) {
        throw new Error(`Non-finite constant not allowed in SQL: ${value}`);
      }
      return String(value);
    }
    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "''")}'`;
    }
    // typeof value === 'boolean'
    return value ? 'TRUE' : 'FALSE';
  }

  // ─── Symbols (variables) ──────────────────────────────────
  private visitSymbol(name: string): string {
    if (name === 'true') return 'TRUE';
    if (name === 'false') return 'FALSE';
    if (name === 'null') return 'NULL';

    const fieldSql = this.ctx.fieldAliases.get(name);
    if (fieldSql !== undefined) return fieldSql;

    const metricSql = this.ctx.metricAliases.get(name);
    if (metricSql !== undefined) return metricSql;

    throw new Error(`Unresolved symbol: "${name}"`);
  }

  // ─── Operators ────────────────────────────────────────────
  private visitOperator(op: string, fn: string, args: MathNode[]): string {
    const sqlArgs = args.map((a) => this.visit(a));

    if (op === '^') return `POWER(${sqlArgs[0]}, ${sqlArgs[1]})`;
    if (fn === 'unaryMinus') return `(-(${sqlArgs[0]}))`;
    if (fn === 'unaryPlus') return `(+(${sqlArgs[0]}))`;
    if (fn === 'not') return `(NOT (${sqlArgs[0]}))`;

    const sqlOp = BINARY_OPERATOR_MAP[op];
    if (!sqlOp) throw new Error(`Unsupported operator: "${op}"`);

    if (op === '/') {
      return `((${sqlArgs[0]}) / NULLIF((${sqlArgs[1]}), 0))`;
    }

    return `((${sqlArgs[0]}) ${sqlOp} (${sqlArgs[1]}))`;
  }

  // ─── Function calls ───────────────────────────────────────
  private visitFunction(fn: MathNode, args: MathNode[]): string {
    if (!isStaticFunctionCall(fn)) {
      throw new Error('Dynamic function calls are not supported in SQL');
    }

    const name = fn.name;
    const handler = FUNCTION_HANDLERS[name];
    if (!handler) {
      throw new Error(
        `Function "${name}" has no SQL equivalent. ` +
          `Supported: ${Object.keys(FUNCTION_HANDLERS).join(', ')}`
      );
    }

    const sqlArgs = args.map((a) => this.visit(a));
    return handler(sqlArgs, this.ctx.dialect);
  }

  // ─── Conditional (ternary) ────────────────────────────────
  private visitConditional(
    condition: MathNode,
    trueExpr: MathNode,
    falseExpr: MathNode
  ): string {
    const cond = this.visit(condition);
    const t = this.visit(trueExpr);
    const f = this.visit(falseExpr);
    return `CASE WHEN (${cond}) THEN (${t}) ELSE (${f}) END`;
  }
}

// ─────────────────────────────────────────────────────────────
// Фабрика контекста
// ─────────────────────────────────────────────────────────────
/**
 * Собирает контекст компиляции формулы: карты «алиас → SQL-выражение»
 * для полей и метрик-зависимостей + целевой диалект.
 */
export function createFormulaToSqlContext(
  fieldAliases: Map<string, string>,
  metricAliases: Map<string, string>,
  dialect: ComputeDialect
): FormulaToSqlContext {
  return { fieldAliases, metricAliases, dialect };
}

/**
 * Оборачивает SQL-выражение в COALESCE(expr, 0) — NULL-зависимости
 * формул считаются нулями (как в mathjs-fallback'е).
 */
export function wrapWithCoalesce(sqlExpr: string): string {
  return `COALESCE(${sqlExpr}, 0)`;
}