import { describe, it, expect } from 'vitest';
import { enteredVmValues, mergeEnteredVms, enteredCalcVmValues, type EnteredCalcSpec } from './overlay';
import type { VirtualMetricValue } from '@/shared/lib/types/computation';

const vm = (id: string, source: string, value: number | null = 0): VirtualMetricValue => ({
  virtualMetricId: id,
  virtualMetricName: id,
  value,
  formattedValue: String(value),
  sourceMetricId: source,
});

describe('enteredVmValues: подстановка по колонке', () => {
  it('маппит vm → значение узла по columnByMetricId', () => {
    const values = { col_itog: 510.94, col_potr: 259.06 };
    const out = enteredVmValues(values, [vm('v1', 'mItog'), vm('v2', 'mPotr')], {
      mItog: 'col_itog',
      mPotr: 'col_potr',
    });
    expect(out).toEqual({ v1: 510.94, v2: 259.06 });
  });
});

describe('enteredCalcVmValues: расчётная по введённым значениям узла', () => {
  const values = { col_itog: 510.94, col_potr: 259.06 };
  const specs: Record<string, EnteredCalcSpec> = {
    mProfit: { formula: 'a / b', operandColumns: { a: 'col_itog', b: 'col_potr' } },
  };

  it('считает формулу на введённых значениях операндов (итого/потребность)', () => {
    const out = enteredCalcVmValues(values, [vm('vP', 'mProfit')], specs);
    expect(out.vP).toBeCloseTo(510.94 / 259.06);
  });

  it('не подменяет, если операнда нет в узле', () => {
    const out = enteredCalcVmValues({ col_itog: 510.94 }, [vm('vP', 'mProfit')], specs);
    expect('vP' in out).toBe(false);
  });

  it('деление на ноль → null (не Infinity)', () => {
    const out = enteredCalcVmValues({ col_itog: 510, col_potr: 0 }, [vm('vP', 'mProfit')], specs);
    expect(out.vP).toBeNull();
  });

  it('overlay расчётной перекрывает значение метрики (fromNode)', () => {
    const entered = enteredCalcVmValues(values, [vm('vP', 'mProfit', 0)], specs);
    const merged = mergeEnteredVms([vm('vP', 'mProfit', 0)], entered);
    expect(merged[0].value).toBeCloseTo(510.94 / 259.06);
    expect(merged[0].fromNode).toBe(true);
  });
});
