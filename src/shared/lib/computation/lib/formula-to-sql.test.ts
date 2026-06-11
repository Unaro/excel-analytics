import { describe, it, expect } from 'vitest';
import {
  FormulaToSqlCompiler,
  createFormulaToSqlContext,
  wrapWithCoalesce,
} from './formula-to-sql';
import type { ComputeDialect } from './types';

/**
 * Компилирует формулу в SQL с контекстом по умолчанию:
 * поля a → "fa", b → "fb"; метрика m → "fm".
 */
function compile(formula: string, dialect: ComputeDialect = 'duckdb') {
  const ctx = createFormulaToSqlContext(
    new Map([
      ['a', '"fa"'],
      ['b', '"fb"'],
    ]),
    new Map([['m', '"fm"']]),
    dialect
  );
  return new FormulaToSqlCompiler(ctx).compile(formula);
}

/** Утверждает успех компиляции и возвращает SQL. */
function sqlOf(formula: string, dialect: ComputeDialect = 'duckdb'): string {
  const result = compile(formula, dialect);
  if (!result.success) throw new Error(`Ожидался успех: ${result.reason}`);
  return result.sql;
}

describe('FormulaToSqlCompiler: базовые узлы', () => {
  it('числовые константы', () => {
    expect(sqlOf('42')).toBe('42');
    expect(sqlOf('3.14')).toBe('3.14');
  });

  it('строковые константы экранируются (одинарные кавычки удваиваются)', () => {
    expect(sqlOf(`"O'Hara"`)).toBe(`'O''Hara'`);
  });

  it('переменные резолвятся из fieldAliases и metricAliases', () => {
    expect(sqlOf('a')).toBe('"fa"');
    expect(sqlOf('m')).toBe('"fm"');
  });

  it('неизвестный символ → ошибка компиляции', () => {
    const result = compile('unknown_var');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.reason).toContain('Unresolved symbol');
  });

  it('true/false/null → SQL-литералы', () => {
    expect(sqlOf('true')).toBe('TRUE');
    expect(sqlOf('false')).toBe('FALSE');
  });
});

describe('FormulaToSqlCompiler: операторы', () => {
  it('арифметика', () => {
    expect(sqlOf('a + b')).toBe('(("fa") + ("fb"))');
    expect(sqlOf('a - b')).toBe('(("fa") - ("fb"))');
    expect(sqlOf('a * b')).toBe('(("fa") * ("fb"))');
  });

  it('деление всегда защищено NULLIF от деления на ноль', () => {
    expect(sqlOf('a / b')).toBe('(("fa") / NULLIF(("fb"), 0))');
  });

  it('возведение в степень → POWER', () => {
    expect(sqlOf('a ^ 2')).toBe('POWER("fa", 2)');
  });

  it('унарный минус', () => {
    expect(sqlOf('-a')).toBe('(-("fa"))');
  });

  it('сравнения маппятся в SQL-операторы', () => {
    expect(sqlOf('a == b')).toBe('(("fa") = ("fb"))');
    expect(sqlOf('a != b')).toBe('(("fa") <> ("fb"))');
    expect(sqlOf('a >= b')).toBe('(("fa") >= ("fb"))');
  });

  it('логические and/or', () => {
    expect(sqlOf('a > 1 and b < 2')).toBe(
      '(((("fa") > (1))) AND ((("fb") < (2))))'
    );
  });

  it('скобки сохраняются', () => {
    expect(sqlOf('(a + b) * 2')).toBe('((((("fa") + ("fb")))) * (2))');
  });
});

describe('FormulaToSqlCompiler: функции', () => {
  it('round с одним и двумя аргументами', () => {
    expect(sqlOf('round(a)')).toBe('ROUND("fa")');
    expect(sqlOf('round(a, 2)')).toBe('ROUND("fa", 2)');
  });

  it('min/max → LEAST/GREATEST', () => {
    expect(sqlOf('min(a, b)')).toBe('LEAST("fa", "fb")');
    expect(sqlOf('max(a, b, 0)')).toBe('GREATEST("fa", "fb", 0)');
  });

  it('divide() защищён NULLIF', () => {
    expect(sqlOf('divide(a, b)')).toBe('("fa" / NULLIF("fb", 0))');
  });

  it('if → CASE WHEN', () => {
    expect(sqlOf('if(a > 0, a, b)')).toBe(
      'CASE WHEN (("fa") > (0)) THEN "fa" ELSE "fb" END'
    );
  });

  it('log10 диалектозависим: LOG10 в DuckDB, LOG в PostgreSQL', () => {
    expect(sqlOf('log10(a)', 'duckdb')).toBe('LOG10("fa")');
    expect(sqlOf('log10(a)', 'postgres')).toBe('LOG("fa")');
  });

  it('функция без SQL-эквивалента → ошибка с перечнем поддерживаемых', () => {
    const result = compile('sin(a)');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toContain('"sin" has no SQL equivalent');
    }
  });

  it('синтаксическая ошибка формулы → failure, не исключение', () => {
    const result = compile('a +* b');
    expect(result.success).toBe(false);
  });
});

describe('wrapWithCoalesce', () => {
  it('оборачивает выражение в COALESCE(expr, 0)', () => {
    expect(wrapWithCoalesce('"x"')).toBe('COALESCE("x", 0)');
  });
});
