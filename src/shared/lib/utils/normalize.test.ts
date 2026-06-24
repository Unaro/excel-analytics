import { describe, it, expect } from 'vitest';
import { columnReference, normalizeValue, normalizeColumn, normalizeVmRows } from './normalize';
import type { VirtualMetricValue } from '@/shared/lib/types/computation';

function vm(id: string, value: number | null): VirtualMetricValue {
  return {
    virtualMetricId: id,
    virtualMetricName: id,
    value,
    formattedValue: String(value ?? '—'),
    sourceMetricId: `src_${id}`,
  };
}

describe('columnReference', () => {
  const col = [10, 20, 30, 40];

  it('total = сумма конечных чисел', () => {
    expect(columnReference(col, 'total')).toBe(100);
  });
  it('max / min / mean', () => {
    expect(columnReference(col, 'max')).toBe(40);
    expect(columnReference(col, 'min')).toBe(10);
    expect(columnReference(col, 'mean')).toBe(25);
  });
  it('игнорирует null/undefined/NaN/Infinity', () => {
    const mixed = [10, null, undefined, NaN, Infinity, 30];
    expect(columnReference(mixed, 'total')).toBe(40);
    expect(columnReference(mixed, 'max')).toBe(30);
  });
  it('пустой столбец → null', () => {
    expect(columnReference([null, undefined], 'total')).toBeNull();
    expect(columnReference([], 'max')).toBeNull();
  });
});

describe('normalizeValue', () => {
  it('доля value/ref', () => {
    expect(normalizeValue(25, 100)).toBe(0.25);
  });
  it('деление на 0 / отсутствие ориентира → null (не Infinity)', () => {
    expect(normalizeValue(25, 0)).toBeNull();
    expect(normalizeValue(25, null)).toBeNull();
  });
  it('нечисловое значение → null', () => {
    expect(normalizeValue(null, 100)).toBeNull();
    expect(normalizeValue(undefined, 100)).toBeNull();
    expect(normalizeValue(NaN, 100)).toBeNull();
  });
});

describe('normalizeColumn', () => {
  it('% от итога: каждый делится на сумму, порядок сохранён', () => {
    expect(normalizeColumn([10, 20, 30, 40], 'total')).toEqual([0.1, 0.2, 0.3, 0.4]);
  });
  it('% от максимума: пик = 1', () => {
    expect(normalizeColumn([10, 20, 40], 'max')).toEqual([0.25, 0.5, 1]);
  });
  it('null-значения остаются null, длина сохраняется', () => {
    const out = normalizeColumn([10, null, 30], 'total');
    expect(out).toEqual([0.25, null, 0.75]);
  });
  it('весь столбец пустой → все null', () => {
    expect(normalizeColumn([null, null], 'total')).toEqual([null, null]);
  });
});

describe('normalizeVmRows', () => {
  const rows = [
    { virtualMetrics: [vm('a', 10), vm('b', 1)] },
    { virtualMetrics: [vm('a', 30), vm('b', 3)] },
  ];

  it('нормализует только метрики из конфига; value=доля, formattedValue=процент', () => {
    const out = normalizeVmRows(rows, new Map([['a', { base: 'total', decimalPlaces: 1 }]]));
    // 'a' → доля от итога (10/40, 30/40), показ процентом (×100)
    expect(out[0].virtualMetrics[0]).toMatchObject({ virtualMetricId: 'a', value: 0.25, formattedValue: '25%' });
    expect(out[1].virtualMetrics[0]).toMatchObject({ virtualMetricId: 'a', value: 0.75, formattedValue: '75%' });
    // 'b' не в карте — без изменений (та же ссылка на объект)
    expect(out[0].virtualMetrics[1]).toBe(rows[0].virtualMetrics[1]);
  });

  it('нормализованной метрике ставит colorFormat=percent (окрашивание в шкале %)', () => {
    // % от максимума может дать >100% → окрашивание должно идти в шкале %,
    // иначе доля 1.51 попадёт в правило «между 0 и 100», хотя на экране 151%.
    const cols = [{ virtualMetrics: [vm('a', 151.23)] }, { virtualMetrics: [vm('a', 100)] }];
    const out = normalizeVmRows(cols, new Map([['a', { base: 'min', decimalPlaces: 2 }]]));
    expect(out[0].virtualMetrics[0].value).toBeCloseTo(1.5123);
    expect(out[0].virtualMetrics[0].formattedValue).toBe('151,23%');
    expect(out[0].virtualMetrics[0].colorFormat).toBe('percent');
  });

  it('пустая карта → возвращает исходные ряды по ссылке', () => {
    expect(normalizeVmRows(rows, new Map())).toBe(rows);
  });

  it('знаменатель — по столбцу переданных рядов (% от максимума)', () => {
    const out = normalizeVmRows(rows, new Map([['a', { base: 'max' }]]));
    expect(out[0].virtualMetrics[0].value).toBeCloseTo(10 / 30);
    expect(out[1].virtualMetrics[0].value).toBe(1);
    expect(out[1].virtualMetrics[0].formattedValue).toBe('100%');
  });

  it('сохраняет прочие поля метрики (fromNode и т.п.)', () => {
    const withNode = [{ virtualMetrics: [{ ...vm('a', 10), fromNode: true }] }, { virtualMetrics: [vm('a', 30)] }];
    const out = normalizeVmRows(withNode, new Map([['a', { base: 'total', decimalPlaces: 1 }]]));
    expect(out[0].virtualMetrics[0].fromNode).toBe(true);
    expect(out[0].virtualMetrics[0].value).toBe(0.25);
  });
});
