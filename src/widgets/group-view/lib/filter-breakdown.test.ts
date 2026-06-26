import { describe, it, expect } from 'vitest';
import { filterBreakdownByRules } from './filter-breakdown';
import type { BreakdownItem } from '@/entities/metric';
import type { DisplayFilterRule } from '@/shared/lib/validators';

const item = (label: string, vals: Record<string, number | null>): BreakdownItem => ({
  label,
  recordCount: 1,
  virtualMetrics: Object.entries(vals).map(([virtualMetricId, value]) => ({
    virtualMetricId,
    virtualMetricName: virtualMetricId,
    value,
    formattedValue: String(value),
    sourceMetricId: virtualMetricId,
  })),
});

const items = [
  item('А', { potr: 150 }),
  item('Б', { potr: 50 }),
  item('В', { potr: null }),
  item('Г', { potr: 300 }),
];

describe('filterBreakdownByRules', () => {
  it('нет правил → элементы как есть (та же ссылка)', () => {
    expect(filterBreakdownByRules(items, undefined, {})).toBe(items);
    expect(filterBreakdownByRules(items, [], {})).toBe(items);
  });

  it('правило > порога: оставляет только превышающие', () => {
    const rules: DisplayFilterRule[] = [{ id: 'r1', metricId: 'potr', operator: '>', value: 100 }];
    expect(filterBreakdownByRules(items, rules, {}).map((i) => i.label)).toEqual(['А', 'Г']);
  });

  it('null-значение метрики правило не проходит', () => {
    const rules: DisplayFilterRule[] = [{ id: 'r1', metricId: 'potr', operator: '<', value: 1000 }];
    // В (null) отсекается, остальные < 1000
    expect(filterBreakdownByRules(items, rules, {}).map((i) => i.label)).toEqual(['А', 'Б', 'Г']);
  });

  it('between по диапазону', () => {
    const rules: DisplayFilterRule[] = [{ id: 'r1', metricId: 'potr', operator: 'between', value: 100, value2: 200 }];
    expect(filterBreakdownByRules(items, rules, {}).map((i) => i.label)).toEqual(['А']);
  });

  it('несколько правил — AND', () => {
    const data = [
      item('X', { potr: 150, ob: 40 }),
      item('Y', { potr: 150, ob: 80 }),
    ];
    const rules: DisplayFilterRule[] = [
      { id: 'r1', metricId: 'potr', operator: '>', value: 100 },
      { id: 'r2', metricId: 'ob', operator: '<', value: 50 },
    ];
    expect(filterBreakdownByRules(data, rules, {}).map((i) => i.label)).toEqual(['X']);
  });

  it('percent: порог сравнивается в масштабе отображения (×100)', () => {
    const data = [item('P', { share: 0.6 })]; // доля 0.6 → 60%
    const rules: DisplayFilterRule[] = [{ id: 'r1', metricId: 'share', operator: '>', value: 50 }];
    expect(filterBreakdownByRules(data, rules, { share: 'percent' }).map((i) => i.label)).toEqual(['P']);
  });
});
