import { describe, it, expect } from 'vitest';
import { toDisplayScale, getColorForValue } from './metric-colors';
import { groupThresholdsByValue } from './thresholds';
import type { VirtualMetric } from '@/shared/lib/validators';
import type { FormattingRule } from './formatting-rules';

describe('toDisplayScale: масштаб условного форматирования', () => {
  it('percent умножает на 100 (доля → проценты)', () => {
    expect(toDisplayScale(0.5687, 'percent')).toBeCloseTo(56.87);
  });
  it('percent_raw не масштабирует (значение уже в процентах)', () => {
    expect(toDisplayScale(57, 'percent_raw')).toBe(57);
  });
  it('остальные форматы — без изменений', () => {
    expect(toDisplayScale(1234, 'number')).toBe(1234);
    expect(toDisplayScale(1234, undefined)).toBe(1234);
  });
});

describe('getColorForValue: порог сравнивается в масштабе отображения', () => {
  const rules: FormattingRule[] = [{ id: 'r', operator: '>', value: 50, color: 'rose' }];

  it('percent: сырое 0.5687 (=56.87%) проходит порог >50', () => {
    // регрессия: раньше сравнивалось сырое 0.5687 > 50 → не срабатывало
    expect(getColorForValue(0.5687, rules, 'percent')).toBe('#f43f5e');
  });
  it('percent: сырое 0.4 (=40%) не проходит >50', () => {
    expect(getColorForValue(0.4, rules, 'percent')).toBeNull();
  });
  it('percent_raw: 57 проходит >50 как есть', () => {
    expect(getColorForValue(57, rules, 'percent_raw')).toBe('#f43f5e');
  });
  it('number: 56 проходит >50', () => {
    expect(getColorForValue(56, rules, 'number')).toBe('#f43f5e');
  });
});

describe('groupThresholdsByValue: линия в масштабе графика, подпись в масштабе отображения', () => {
  const vm = (over: Partial<VirtualMetric>): VirtualMetric => ({
    id: 'm1', name: 'M', displayFormat: 'number', decimalPlaces: 0, order: 0, ...over,
  });

  it('percent: порог 50% → линия на 0.5 (сырое), подпись 50', () => {
    const metrics = [vm({
      displayFormat: 'percent',
      colorConfig: { rules: [{ id: 'r', operator: '>', value: 50, color: 'rose' }] },
    })];
    const [g] = groupThresholdsByValue(metrics, ['m1']);
    expect(g.y).toBeCloseTo(0.5);       // позиция среди сырых баров (0..1)
    expect(g.labelValue).toBe(50);       // подпись — как ввёл пользователь
  });

  it('number: линия и подпись совпадают', () => {
    const metrics = [vm({
      colorConfig: { rules: [{ id: 'r', operator: '>', value: 50, color: 'rose' }] },
    })];
    const [g] = groupThresholdsByValue(metrics, ['m1']);
    expect(g.y).toBe(50);
    expect(g.labelValue).toBe(50);
  });

  it('percent: пороги 100% и 50% НЕ склеиваются в одну линию (75)', () => {
    // регрессия: floor допуска Math.max(.., 1) в масштабе построения
    // схлопывал доли 1.0 и 0.5 (|0.5| ≤ 1) в среднюю линию 0.75 / подпись 75
    const metrics = [vm({
      displayFormat: 'percent',
      colorConfig: {
        rules: [
          { id: 'hi', operator: '>', value: 100, color: 'emerald' },
          { id: 'lo', operator: '>', value: 50, color: 'rose' },
        ],
      },
    })];
    const groups = groupThresholdsByValue(metrics, ['m1']);
    expect(groups).toHaveLength(2);
    expect(groups.map(g => g.labelValue).sort((a, b) => a - b)).toEqual([50, 100]);
    expect(groups.every(g => !g.isOverlap)).toBe(true);
  });

  it('number: близкие пороги в пределах 0.5% размаха склеиваются', () => {
    // относительный допуск сохраняется: размах 0..1002 → допуск 0.5%*1002≈5,
    // поэтому 1000 и 1002 (Δ=2) сливаются, а 0 остаётся отдельной линией
    const metrics = [vm({
      colorConfig: {
        rules: [
          { id: 'z', operator: '>', value: 0, color: 'slate' },
          { id: 'a', operator: '>', value: 1000, color: 'emerald' },
          { id: 'b', operator: '>', value: 1002, color: 'rose' },
        ],
      },
    })];
    const groups = groupThresholdsByValue(metrics, ['m1']);
    expect(groups).toHaveLength(2);
    expect(groups.find(g => g.isOverlap)?.rules).toHaveLength(2);
  });
});
