import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { postProcessAggregates, recalculateFormulasOnAggregated } from './post-process';
import type { CompiledQuery, CompiledFormulaMeta } from './types';

/** Собирает CompiledQuery с заданными формулами и SQL-алиасами. */
function makeCompiled(
  formulas: Record<string, CompiledFormulaMeta> = {},
  calculatedInSql: string[] = []
): CompiledQuery {
  return {
    sql: '',
    formulas: new Map(Object.entries(formulas)),
    aggregateMetadata: new Map(),
    calculatedInSqlAliases: new Set(calculatedInSql),
  };
}

/** Метаданные формулы с field-зависимостями. */
function formulaMeta(
  formula: string,
  fields: { alias: string }[],
  metrics: { alias: string; metricId: string }[] = []
): CompiledFormulaMeta {
  return {
    groupId: 'g1',
    metricId: 'mc',
    templateId: 'tpl',
    formula,
    fieldDependencies: fields.map((f) => ({
      alias: f.alias,
      columnName: `col_${f.alias}`,
      aggregateFn: 'SUM',
    })),
    metricDependencies: metrics,
  };
}

let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
  errorSpy.mockRestore();
});

describe('postProcessAggregates', () => {
  it('пустой результат SQL → пустой массив', () => {
    expect(postProcessAggregates([], makeCompiled())).toEqual([]);
  });

  it('числовые и bigint значения нормализуются, остальное → null', () => {
    const rows = [{ 'g1__m1': 10, 'g1__m2': 20n, 'g1__m3': 'строка' }];
    const [result] = postProcessAggregates(rows, makeCompiled());

    expect(result['g1__m1']).toBe(10);
    expect(result['g1__m2']).toBe(20);
    expect(result['g1__m3']).toBeNull();
  });

  it('метрика, вычисленная в SQL (CTE), берётся из строки без пересчёта', () => {
    const compiled = makeCompiled(
      { 'base_g1__mc': formulaMeta('a / 0', [{ alias: 'a' }]) }, // формула бы упала
      ['g1__mc']
    );
    const rows = [{ 'g1__mc': 7, '_fbg1_mc_a': 100 }];
    const [result] = postProcessAggregates(rows, compiled);

    expect(result['g1__mc']).toBe(7);
  });

  it('метрика вне SQL пересчитывается через mathjs по _fb-зависимостям', () => {
    const compiled = makeCompiled({
      'base_g1__mc': formulaMeta('a / b', [{ alias: 'a' }, { alias: 'b' }]),
    });
    const rows = [{ '_fbg1_mc_a': 10, '_fbg1_mc_b': 4 }];
    const [result] = postProcessAggregates(rows, compiled);

    expect(result['g1__mc']).toBe(2.5);
  });

  it('отсутствующие зависимости подставляются нулями', () => {
    const compiled = makeCompiled({
      'base_g1__mc': formulaMeta('a + 5', [{ alias: 'a' }]),
    });
    const [result] = postProcessAggregates([{}], compiled);

    expect(result['g1__mc']).toBe(5);
  });

  it('нечисловой/нефинитный результат формулы → null', () => {
    const compiled = makeCompiled({
      'base_g1__mc': formulaMeta('a / b', [{ alias: 'a' }, { alias: 'b' }]),
    });
    // b = 0 → деление на ноль → Infinity → null
    const rows = [{ '_fbg1_mc_a': 1, '_fbg1_mc_b': 0 }];
    const [result] = postProcessAggregates(rows, compiled);

    expect(result['g1__mc']).toBeNull();
  });

  it('метрика-зависимость другой метрики резолвится по metricId', () => {
    const base = formulaMeta('a * 2', [{ alias: 'a' }]);
    const dependent: CompiledFormulaMeta = {
      groupId: 'g1',
      metricId: 'md',
      templateId: 'tpl2',
      formula: 'x + 1',
      fieldDependencies: [],
      metricDependencies: [{ alias: 'x', metricId: 'mc' }],
    };
    const compiled = makeCompiled({
      'base_g1__md': dependent,
      'base_g1__mc': base,
    });
    const rows = [{ '_fbg1_mc_a': 10 }];
    const [result] = postProcessAggregates(rows, compiled);

    expect(result['g1__mc']).toBe(20);
    expect(result['g1__md']).toBe(21); // топосорт: mc раньше md
  });
});

describe('recalculateFormulasOnAggregated', () => {
  it('пересчитывает формулы на агрегированной строке', () => {
    const formulas: CompiledQuery['formulas'] = new Map([
      ['base_g1__mc', formulaMeta('a / b', [{ alias: 'a' }, { alias: 'b' }])],
    ]);
    const aggregated = {
      _record_count: 2,
      '_fbg1_mc_a': 4,
      '_fbg1_mc_b': 4,
      'g1__mc': null,
    };

    const result = recalculateFormulasOnAggregated(aggregated, formulas);

    expect(result['g1__mc']).toBe(1);
  });

  it('ошибка вычисления одной формулы не ломает остальные', () => {
    const formulas: CompiledQuery['formulas'] = new Map([
      ['base_g1__bad', formulaMeta('sqrt(', [])], // синтаксическая ошибка
      ['base_g1__ok', formulaMeta('a + 1', [{ alias: 'a' }])],
    ]);
    const result = recalculateFormulasOnAggregated(
      { _record_count: 1, '_fbg1_mc_a': 1 },
      formulas
    );

    expect(result['g1__ok']).toBe(2);
    expect(errorSpy).toHaveBeenCalled();
  });
});
