import { describe, it, expect } from 'vitest';
import { preprocessAggregateFormula, DEFAULT_AGGREGATE_OPTIONS } from './aggregate-formula';

const fields = (m: Record<string, string>) => new Map(Object.entries(m));
const noMetrics = new Set<string>();

describe('preprocessAggregateFormula: голые колонки', () => {
  it('авто-оборачивает в дефолтный SUM (поведение старых формул сохраняется)', () => {
    const r = preprocessAggregateFormula('a / b', fields({ a: 'col_a', b: 'col_b' }), noMetrics);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.formula.replace(/\s/g, '')).toBe('col_a__SUM/col_b__SUM');
    expect(r.fieldDependencies).toEqual([
      { alias: 'col_a__SUM', columnName: 'col_a', aggregateFn: 'SUM' },
      { alias: 'col_b__SUM', columnName: 'col_b', aggregateFn: 'SUM' },
    ]);
  });

  it('дефолтный агрегат настраивается', () => {
    const r = preprocessAggregateFormula('a', fields({ a: 'col_a' }), noMetrics, {
      defaultAggregate: 'AVG', requireExplicit: false,
    });
    expect(r.success && r.fieldDependencies[0].aggregateFn).toBe('AVG');
  });

  it('requireExplicit запрещает голую колонку', () => {
    const r = preprocessAggregateFormula('a / b', fields({ a: 'col_a', b: 'col_b' }), noMetrics, {
      defaultAggregate: 'SUM', requireExplicit: true,
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error).toContain('должна быть внутри агрегатной функции');
  });
});

describe('preprocessAggregateFormula: явные агрегаты', () => {
  it('MAX(a)/SUM(b) → разные зависимости', () => {
    const r = preprocessAggregateFormula('MAX(a) / SUM(b)', fields({ a: 'ca', b: 'cb' }), noMetrics);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.fieldDependencies).toEqual([
      { alias: 'ca__MAX', columnName: 'ca', aggregateFn: 'MAX' },
      { alias: 'cb__SUM', columnName: 'cb', aggregateFn: 'SUM' },
    ]);
  });

  it('одна колонка под разными агрегатами — разные зависимости', () => {
    const r = preprocessAggregateFormula('(MAX(a)/SUM(a)) - MIN(b)', fields({ a: 'ca', b: 'cb' }), noMetrics);
    expect(r.success).toBe(true);
    if (!r.success) return;
    const aliases = r.fieldDependencies.map(d => d.alias).sort();
    expect(aliases).toEqual(['ca__MAX', 'ca__SUM', 'cb__MIN']);
  });

  it('дубль агрегата дедуплицируется', () => {
    const r = preprocessAggregateFormula('SUM(a) + SUM(a)', fields({ a: 'ca' }), noMetrics);
    expect(r.success && r.fieldDependencies).toHaveLength(1);
  });

  it('скалярная функция сохраняется, агрегаты внутри разворачиваются', () => {
    const r = preprocessAggregateFormula('round(SUM(a) / SUM(b), 2)', fields({ a: 'ca', b: 'cb' }), noMetrics);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.formula).toContain('round(');
    expect(r.fieldDependencies).toHaveLength(2);
  });

  it('ссылка на метрику не агрегируется (проходит как есть)', () => {
    const r = preprocessAggregateFormula('SUM(a) / m', fields({ a: 'ca' }), new Set(['m']));
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.formula).toContain('m');
    expect(r.fieldDependencies).toEqual([{ alias: 'ca__SUM', columnName: 'ca', aggregateFn: 'SUM' }]);
  });

  it('COUNT_DISTINCT распознаётся', () => {
    const r = preprocessAggregateFormula('COUNT_DISTINCT(a)', fields({ a: 'ca' }), noMetrics);
    expect(r.success && r.fieldDependencies[0].aggregateFn).toBe('COUNT_DISTINCT');
  });
});

describe('preprocessAggregateFormula: валидация', () => {
  it('вложенный агрегат → ошибка (аргумент должен быть одной колонкой)', () => {
    const r = preprocessAggregateFormula('SUM(MAX(a))', fields({ a: 'ca' }), noMetrics);
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error).toContain('SUM');
  });

  it('агрегат над выражением → ошибка', () => {
    const r = preprocessAggregateFormula('SUM(a + b)', fields({ a: 'ca', b: 'cb' }), noMetrics);
    expect(r.success).toBe(false);
  });

  it('агрегат над метрикой → ошибка', () => {
    const r = preprocessAggregateFormula('SUM(m)', fields({}), new Set(['m']));
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error).toContain('нельзя применять к метрике');
  });

  it('агрегат над непривязанной переменной → ошибка', () => {
    const r = preprocessAggregateFormula('SUM(x)', fields({}), noMetrics);
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error).toContain('не привязана к колонке');
  });

  it('битая формула → failure, не исключение', () => {
    const r = preprocessAggregateFormula('a +', fields({ a: 'ca' }), noMetrics);
    expect(r.success).toBe(false);
  });

  it('пустая формула → success, пустые зависимости', () => {
    const r = preprocessAggregateFormula('', fields({}), noMetrics, DEFAULT_AGGREGATE_OPTIONS);
    expect(r.success && r.fieldDependencies).toEqual([]);
  });
});
