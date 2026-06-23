import { describe, it, expect } from 'vitest';
import { effectiveChartFormat, buildNormalizedChartConfigs } from './chart-format';

describe('effectiveChartFormat', () => {
  it('нормализованная метрика → percent (вне зависимости от формата)', () => {
    expect(effectiveChartFormat('currency', true)).toBe('percent');
    expect(effectiveChartFormat(undefined, true)).toBe('percent');
  });
  it('обычная метрика → собственный формат (включая undefined)', () => {
    expect(effectiveChartFormat('decimal', false)).toBe('decimal');
    expect(effectiveChartFormat(undefined, false)).toBeUndefined();
  });
});

describe('buildNormalizedChartConfigs', () => {
  const cfgs = [
    { id: 'a', displayFormat: 'number' },
    { id: 'b', displayFormat: 'currency' },
  ];

  it('пустая карта → исходный массив по ссылке (без копий)', () => {
    const map = new Map<string, unknown>();
    expect(buildNormalizedChartConfigs(cfgs, map)).toBe(cfgs);
  });

  it('нормализованная метрика → displayFormat=percent, остальные по ссылке', () => {
    const map = new Map<string, unknown>([['a', { base: 'total' }]]);
    const out = buildNormalizedChartConfigs(cfgs, map);
    expect(out).not.toBe(cfgs); // новый массив
    expect(out[0]).toEqual({ id: 'a', displayFormat: 'percent' });
    expect(out[1]).toBe(cfgs[1]); // 'b' не тронут — та же ссылка
  });

  it('не мутирует исходные конфиги', () => {
    const map = new Map<string, unknown>([['a', {}]]);
    buildNormalizedChartConfigs(cfgs, map);
    expect(cfgs[0].displayFormat).toBe('number');
  });
});
