import { describe, it, expect } from 'vitest';
import { heatmapExtent, heatmapColor } from './heatmap';

describe('heatmapExtent', () => {
  it('мин/макс по числам, игнорируя null/NaN', () => {
    expect(heatmapExtent([10, null, 5, NaN, 20])).toEqual({ min: 5, max: 20 });
  });
  it('нет валидных значений → null', () => {
    expect(heatmapExtent([null, undefined, NaN])).toBeNull();
    expect(heatmapExtent([])).toBeNull();
  });
  it('отрицательные значения', () => {
    expect(heatmapExtent([-30, -5, -50])).toEqual({ min: -50, max: -5 });
  });
});

describe('heatmapColor', () => {
  const ext = { min: 0, max: 100 };
  const alpha = (s?: string) => (s ? Number(s.match(/,\s*([\d.]+)\)/)![1]) : undefined);

  it('t=0 (min) → минимальная альфа', () => {
    expect(alpha(heatmapColor(0, ext))).toBeCloseTo(0.06);
  });
  it('t=1 (max) → максимальная альфа', () => {
    expect(alpha(heatmapColor(100, ext))).toBeCloseTo(0.70);
  });
  it('середина → средняя альфа', () => {
    expect(alpha(heatmapColor(50, ext))).toBeCloseTo(0.38);
  });
  it('значения за пределами экстента клампятся', () => {
    expect(alpha(heatmapColor(200, ext))).toBeCloseTo(0.70);
    expect(alpha(heatmapColor(-50, ext))).toBeCloseTo(0.06);
  });
  it('null / пустой экстент → undefined', () => {
    expect(heatmapColor(null, ext)).toBeUndefined();
    expect(heatmapColor(50, null)).toBeUndefined();
  });
  it('min==max → t=0 (ровный слабый фон), без деления на ноль', () => {
    expect(alpha(heatmapColor(42, { min: 42, max: 42 }))).toBeCloseTo(0.06);
  });
});
