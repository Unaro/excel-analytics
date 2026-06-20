import { describe, it, expect } from 'vitest';
import { autoRadarDomain } from './chart-domain';

describe('autoRadarDomain: авто-домен радара', () => {
  it('доли < 1 не якорятся в 0 — домен подгоняется под диапазон', () => {
    const [min, max] = autoRadarDomain([0.2, 0.35, 0.5])!;
    // паддинг 8% от размаха (0.3): min<0.2, max>0.5, но не от нуля
    expect(min).toBeGreaterThan(0);
    expect(min).toBeLessThan(0.2);
    expect(max).toBeGreaterThan(0.5);
    expect(min).toBeCloseTo(0.2 - 0.3 * 0.08, 5);
    expect(max).toBeCloseTo(0.5 + 0.3 * 0.08, 5);
  });

  it('единственное значение — симметричный паддинг', () => {
    const [min, max] = autoRadarDomain([0.4])!;
    expect(min).toBeCloseTo(0.4 - 0.04, 5);
    expect(max).toBeCloseTo(0.4 + 0.04, 5);
  });

  it('единственное значение 0 — паддинг ±1 (без деления на ноль)', () => {
    expect(autoRadarDomain([0])).toEqual([-1, 1]);
  });

  it('нечисловые/пустые — undefined (дефолт recharts)', () => {
    expect(autoRadarDomain([])).toBeUndefined();
    expect(autoRadarDomain([NaN, Infinity])).toBeUndefined();
  });

  it('игнорирует нечисловые среди валидных', () => {
    const d = autoRadarDomain([1, NaN, 3, Infinity]);
    expect(d).toEqual([1 - 0.16, 3 + 0.16]);
  });
});
