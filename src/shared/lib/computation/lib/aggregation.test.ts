import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { aggregateProcessedRows } from './aggregation';
import type { CompiledQuery, MetricAggregationMeta } from './types';

/** Метаданные агрегации для набора алиасов. */
function meta(
  entries: Record<string, MetricAggregationMeta['aggregateFunction']>
): Map<string, MetricAggregationMeta> {
  return new Map(
    Object.entries(entries).map(([k, fn]) => [k, { aggregateFunction: fn }])
  );
}

const noFormulas: CompiledQuery['formulas'] = new Map();

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

describe('aggregateProcessedRows: базовые случаи', () => {
  it('пустой вход → { _record_count: 0 }', () => {
    expect(aggregateProcessedRows([], meta({}), noFormulas)).toEqual({
      _record_count: 0,
    });
  });

  it('_record_count суммируется по строкам', () => {
    const rows = [
      { _record_count: 10, 'g1__m1': 1 },
      { _record_count: 32, 'g1__m1': 2 },
    ];
    const result = aggregateProcessedRows(rows, meta({ 'g1__m1': 'SUM' }), noFormulas);

    expect(result._record_count).toBe(42);
  });
});

describe('aggregateProcessedRows: переагрегация по типу функции', () => {
  const rows = [
    { _record_count: 1, 'g1__m1': 10 },
    { _record_count: 1, 'g1__m1': 30 },
  ];

  it('SUM суммирует значения строк', () => {
    const result = aggregateProcessedRows(rows, meta({ 'g1__m1': 'SUM' }), noFormulas);
    expect(result['g1__m1']).toBe(40);
  });

  it('MAX/MIN берут экстремумы', () => {
    expect(
      aggregateProcessedRows(rows, meta({ 'g1__m1': 'MAX' }), noFormulas)['g1__m1']
    ).toBe(30);
    expect(
      aggregateProcessedRows(rows, meta({ 'g1__m1': 'MIN' }), noFormulas)['g1__m1']
    ).toBe(10);
  });

  it('AVG пересчитывается через служебные __agg_sum__/__agg_count__ (взвешенно)', () => {
    const avgRows = [
      // группа из 4 записей со средним 10 (sum=40)
      { _record_count: 4, 'g1__m1': 10, '__agg_sum__g1__m1': 40, '__agg_count__g1__m1': 4 },
      // группа из 1 записи со средним 50 (sum=50)
      { _record_count: 1, 'g1__m1': 50, '__agg_sum__g1__m1': 50, '__agg_count__g1__m1': 1 },
    ];
    const result = aggregateProcessedRows(avgRows, meta({ 'g1__m1': 'AVG' }), noFormulas);

    // (40 + 50) / (4 + 1) = 18, а не среднее средних (30)
    expect(result['g1__m1']).toBe(18);
    // Служебные алиасы не попадают в итог как значения
    expect(result['__agg_sum__g1__m1']).toBeNull();
  });

  it('COUNT_DISTINCT и MEDIAN непереагрегируемы → null', () => {
    expect(
      aggregateProcessedRows(rows, meta({ 'g1__m1': 'COUNT_DISTINCT' }), noFormulas)['g1__m1']
    ).toBeNull();
    expect(
      aggregateProcessedRows(rows, meta({ 'g1__m1': 'MEDIAN' }), noFormulas)['g1__m1']
    ).toBeNull();
  });

  it('значения null/NaN отфильтровываются перед агрегацией', () => {
    const dirty = [
      { _record_count: 1, 'g1__m1': 10 },
      { _record_count: 1, 'g1__m1': null },
      { _record_count: 1, 'g1__m1': NaN },
    ];
    const result = aggregateProcessedRows(dirty, meta({ 'g1__m1': 'SUM' }), noFormulas);

    expect(result['g1__m1']).toBe(10);
  });

  it('все значения null → null', () => {
    const empty = [{ _record_count: 1, 'g1__m1': null }];
    const result = aggregateProcessedRows(empty, meta({ 'g1__m1': 'SUM' }), noFormulas);

    expect(result['g1__m1']).toBeNull();
  });
});

describe('aggregateProcessedRows: calculated-метрики', () => {
  it('field-зависимости суммируются, формула пересчитывается на агрегатах', () => {
    const formulas: CompiledQuery['formulas'] = new Map([
      [
        'base_g1__mc',
        {
          groupId: 'g1',
          metricId: 'mc',
          templateId: 'tpl',
          formula: 'a / b',
          fieldDependencies: [
            { alias: 'a', columnName: 'col_a', aggregateFn: 'SUM' },
            { alias: 'b', columnName: 'col_b', aggregateFn: 'SUM' },
          ],
          metricDependencies: [],
        },
      ],
    ]);

    const rows = [
      // a/b построчно: 1/2 и 3/2 — но корректный итог = (1+3)/(2+2) = 1
      { _record_count: 1, 'g1__mc': 0.5, '_fbg1_mc_a': 1, '_fbg1_mc_b': 2 },
      { _record_count: 1, 'g1__mc': 1.5, '_fbg1_mc_a': 3, '_fbg1_mc_b': 2 },
    ];

    const result = aggregateProcessedRows(rows, meta({}), formulas);

    expect(result['_fbg1_mc_a']).toBe(4);
    expect(result['_fbg1_mc_b']).toBe(4);
    // Формула пересчитана на суммах зависимостей, а не усреднена по строкам
    expect(result['g1__mc']).toBe(1);
  });
});

describe('интеграция postProcessAggregates → aggregateProcessedRows', () => {
  it('AVG в «Итого» взвешивается по __agg_sum__/__agg_count__, прошедшим пост-обработку', async () => {
    const { postProcessAggregates } = await import('./post-process');

    // Имитация SQL-строк group-by: служебные суммы/счётчики из компилятора.
    // Регрессия: post-process вырезал __agg_*-ключи, и итог AVG был «—».
    const sqlRows = [
      {
        _group_label: 'A',
        _record_count: 4,
        'g1__m1': 10,
        '__agg_sum__g1__m1': 40n, // bigint, как отдаёт DuckDB
        '__agg_count__g1__m1': 4n,
      },
      {
        _group_label: 'B',
        _record_count: 1,
        'g1__m1': 50,
        '__agg_sum__g1__m1': 50n,
        '__agg_count__g1__m1': 1n,
      },
    ];

    const compiled = {
      sql: '',
      formulas: noFormulas,
      aggregateMetadata: meta({ 'g1__m1': 'AVG' }),
      calculatedInSqlAliases: new Set<string>(),
    };

    const processed = postProcessAggregates(
      sqlRows as Record<string, unknown>[],
      compiled as never
    );
    // Служебные ключи дошли до агрегации числами
    expect(processed[0]['__agg_sum__g1__m1']).toBe(40);

    const summary = aggregateProcessedRows(
      processed,
      compiled.aggregateMetadata,
      noFormulas
    );
    // Взвешенно: (40 + 50) / (4 + 1) = 18, а не среднее средних 30
    expect(summary['g1__m1']).toBe(18);
  });
});

describe('field-dependency AVG в формуле: взвешенное «Итого»', () => {
  it('AVG переагрегируется через __agg_sum__/__agg_count__, а не среднее средних', () => {
    const formulas: CompiledQuery['formulas'] = new Map([
      ['base_g1__mc', {
        groupId: 'g1', metricId: 'mc', templateId: 'tpl', formula: 'col_a__AVG',
        fieldDependencies: [{ alias: 'col_a__AVG', columnName: 'col_a', aggregateFn: 'AVG' }],
        metricDependencies: [],
      }],
    ]);

    const dep = '_fbg1_mc_col_a__AVG';
    const rows = [
      // группа A: avg=10, sum=40, count=4
      { _record_count: 4, [dep]: 10, [`__agg_sum__${dep}`]: 40, [`__agg_count__${dep}`]: 4 },
      // группа B: avg=50, sum=50, count=1
      { _record_count: 1, [dep]: 50, [`__agg_sum__${dep}`]: 50, [`__agg_count__${dep}`]: 1 },
    ];

    const result = aggregateProcessedRows(rows, meta({}), formulas);
    // Взвешенно: (40+50)/(4+1) = 18, а не среднее средних 30
    expect(result[dep]).toBe(18);
  });

  it('MAX-зависимость переагрегируется как максимум максимумов', () => {
    const formulas: CompiledQuery['formulas'] = new Map([
      ['base_g1__mx', {
        groupId: 'g1', metricId: 'mx', templateId: 'tpl', formula: 'col_a__MAX',
        fieldDependencies: [{ alias: 'col_a__MAX', columnName: 'col_a', aggregateFn: 'MAX' }],
        metricDependencies: [],
      }],
    ]);
    const dep = '_fbg1_mx_col_a__MAX';
    const rows = [
      { _record_count: 3, [dep]: 12 },
      { _record_count: 5, [dep]: 47 },
      { _record_count: 1, [dep]: 30 },
    ];
    const result = aggregateProcessedRows(rows, meta({}), formulas);
    expect(result[dep]).toBe(47);
  });
});
