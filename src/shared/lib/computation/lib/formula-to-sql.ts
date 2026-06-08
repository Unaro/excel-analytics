import {
  parse,
  MathNode,
  FunctionNode,
  OperatorNode,
  ParenthesisNode,
  ConstantNode,
  SymbolNode,
  ConditionalNode,
} from 'mathjs';
import type { ComputeDialect } from './types';

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
// Внутренние интерфейсы для работы с AST-нодами
//
// mathjs имеет очень строгие дженерики (ConstantNode<T>, OperatorNode<Op, Fn, Args>),
// которые практически невозможно удовлетворить при динамической работе с AST.
// После instanceof-проверки в visit() мы знаем конкретный тип ноды,
// но TypeScript не может автоматически сузить дженерики.
//
// Решение: вводим минимальные интерфейсы с нужными полями и работаем
// с ними через безопасное приведение. Это НЕ any — это конкретный контракт.
// ─────────────────────────────────────────────────────────────

/** Контракт ConstantNode: нам нужно только поле value */
interface ConstantNodeValue {
  value: string | number | boolean | null | undefined;
}

/** Контракт OperatorNode: op, fn и args */
interface OperatorNodeShape {
  op: string;
  fn: string;
  args: MathNode[];
}

/** Контракт FunctionNode: fn как SymbolNode + args */
interface FunctionNodeShape {
  fn: { name: string } | MathNode;
  args: MathNode[];
}

/** Контракт ConditionalNode */
interface ConditionalNodeShape {
  condition: MathNode;
  trueExpr: MathNode;
  falseExpr: MathNode;
}

// ─────────────────────────────────────────────────────────────
// Маппинг бинарных операторов
// ─────────────────────────────────────────────────────────────

const BINARY_OPERATOR_MAP: Record<string, string> = {
  '+': '+',
  '-': '-',
  '*': '*',
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
  // Здесь instanceof-проверки гарантируют тип ноды.
  // Приведение к внутренним интерфейсам безопасно.
  private visit(node: MathNode): string {
    if (node instanceof ConstantNode) {
      return this.visitConstant(node as unknown as ConstantNodeValue);
    }
    if (node instanceof SymbolNode) {
      return this.visitSymbol(node);
    }
    if (node instanceof OperatorNode) {
      return this.visitOperator(node as unknown as OperatorNodeShape);
    }
    if (node instanceof FunctionNode) {
      return this.visitFunction(node as unknown as FunctionNodeShape);
    }
    if (node instanceof ParenthesisNode) {
      return `(${this.visit(node.content)})`;
    }
    if (node instanceof ConditionalNode) {
      return this.visitConditional(node as unknown as ConditionalNodeShape);
    }
    throw new Error(`Unsupported AST node type: "${node.type}"`);
  }

  // ─── Constants ────────────────────────────────────────────
  private visitConstant(node: ConstantNodeValue): string {
    const v = node.value;
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'number') {
      if (!isFinite(v)) {
        throw new Error(`Non-finite constant not allowed in SQL: ${v}`);
      }
      return String(v);
    }
    if (typeof v === 'string') {
      return `'${v.replace(/'/g, "''")}'`;
    }
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    throw new Error(`Unsupported constant type: ${typeof v}`);
  }

  // ─── Symbols (variables) ──────────────────────────────────
  private visitSymbol(node: SymbolNode): string {
    const name = node.name;
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
  private visitOperator(node: OperatorNodeShape): string {
    const args = node.args.map((a) => this.visit(a));

    if (node.op === '^') return `POWER(${args[0]}, ${args[1]})`;
    if (node.fn === 'unaryMinus') return `(-(${args[0]}))`;
    if (node.fn === 'unaryPlus') return `(+(${args[0]}))`;
    if (node.fn === 'not') return `(NOT (${args[0]}))`;

    const sqlOp = BINARY_OPERATOR_MAP[node.op];
    if (!sqlOp) throw new Error(`Unsupported operator: "${node.op}"`);
    if (node.op === '/') {
      return `((${args[0]}) / NULLIF((${args[1]}), 0))`;
    }

    return `((${args[0]}) ${sqlOp} (${args[1]}))`;
  }

  // ─── Function calls ───────────────────────────────────────
  private visitFunction(node: FunctionNodeShape): string {
    // Проверяем, что fn — это SymbolNode (статический вызов)
    const fn = node.fn;
    if (!('name' in fn) || typeof fn.name !== 'string') {
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

    const args = node.args.map((a) => this.visit(a));
    return handler(args, this.ctx.dialect);
  }

  // ─── Conditional (ternary) ────────────────────────────────
  private visitConditional(node: ConditionalNodeShape): string {
    const cond = this.visit(node.condition);
    const trueExpr = this.visit(node.trueExpr);
    const falseExpr = this.visit(node.falseExpr);
    return `CASE WHEN (${cond}) THEN (${trueExpr}) ELSE (${falseExpr}) END`;
  }
}

// ─────────────────────────────────────────────────────────────
// Фабрика контекста
// ─────────────────────────────────────────────────────────────

export function createFormulaToSqlContext(
  fieldAliases: Map<string, string>,
  metricAliases: Map<string, string>,
  dialect: ComputeDialect
): FormulaToSqlContext {
  return { fieldAliases, metricAliases, dialect };
}

export function wrapWithCoalesce(sqlExpr: string): string {
  return `COALESCE(${sqlExpr}, 0)`;
}