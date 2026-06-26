import { describe, it, expect } from 'vitest';
import { enteredVmValues, mergeEnteredVms, enteredCalcVmValues, rollupNodeValues, rollupNodes, type EnteredCalcSpec } from './overlay';
import type { VirtualMetricValue } from '@/shared/lib/types/computation';
import type { AggregateNode } from '@/shared/lib/types/aggregate';
import { nodePathKey } from '@/shared/lib/types/aggregate';

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

describe('rollupNodeValues: fallback-сумма детей при пустом уровне', () => {
  const node = (path: string[], level: number, values: Record<string, number | null>): AggregateNode =>
    ({ path, level, label: path[path.length - 1] ?? '', isTotal: false, values });

  it('узел со своим значением — берётся как есть (без суммы детей)', () => {
    const nodes = [
      node(['Город'], 0, { potr: 100 }),
      node(['Город', 'Р1'], 1, { potr: 30 }),
      node(['Город', 'Р2'], 1, { potr: 50 }),
    ];
    const rolled = rollupNodeValues(nodes);
    // у «Город» своё значение 100 — приоритет над суммой детей (80)
    expect(rolled.get(nodePathKey(['Город']))!.potr).toBe(100);
  });

  it('пустой уровень добирает сумму детей', () => {
    const nodes = [
      node(['Город'], 0, { potr: null }),
      node(['Город', 'Р1'], 1, { potr: 30 }),
      node(['Город', 'Р2'], 1, { potr: 50 }),
    ];
    const rolled = rollupNodeValues(nodes);
    expect(rolled.get(nodePathKey(['Город']))!.potr).toBe(80);
  });

  it('рекурсивный спуск: пустые дети добирают со внуков', () => {
    const nodes = [
      node(['Г'], 0, { potr: null }),
      node(['Г', 'Р1'], 1, { potr: null }),
      node(['Г', 'Р1', 'М1'], 2, { potr: 10 }),
      node(['Г', 'Р1', 'М2'], 2, { potr: 5 }),
      node(['Г', 'Р2'], 1, { potr: 20 }),
    ];
    const rolled = rollupNodeValues(nodes);
    expect(rolled.get(nodePathKey(['Г', 'Р1']))!.potr).toBe(15); // внуки
    expect(rolled.get(nodePathKey(['Г']))!.potr).toBe(35);       // 15 + 20
  });

  it('0 — реальное значение, не триггерит fallback', () => {
    const nodes = [
      node(['Г'], 0, { potr: 0 }),
      node(['Г', 'Р1'], 1, { potr: 99 }),
    ];
    const rolled = rollupNodeValues(nodes);
    expect(rolled.get(nodePathKey(['Г']))!.potr).toBe(0);
  });

  it('нет детей и нет значения → null', () => {
    const nodes = [node(['Г'], 0, { potr: null })];
    const rolled = rollupNodeValues(nodes);
    expect(rolled.get(nodePathKey(['Г']))!.potr).toBeNull();
  });

  it('синтетический корень (пустой путь) = сумма узлов верхнего уровня', () => {
    const nodes = [
      node(['Р1'], 0, { potr: 100 }),
      node(['Р2'], 0, { potr: 250 }),
      node(['Р1', 'М1'], 1, { potr: 40 }),
    ];
    const root = rollupNodeValues(nodes).get(nodePathKey([]))!;
    expect(root.potr).toBe(350); // 100 + 250 (дети Р1 не двойного счёта)
  });

  it('синтетический корень исключает строки «Итого» (isTotal)', () => {
    const nodes: AggregateNode[] = [
      { path: ['Р1'], level: 0, label: 'Р1', isTotal: false, values: { potr: 100 } },
      { path: ['Всего'], level: 0, label: 'Всего', isTotal: true, values: { potr: 999 } },
    ];
    const root = rollupNodeValues(nodes).get(nodePathKey([]))!;
    expect(root.potr).toBe(100); // «Всего» (isTotal) не суммируется
  });

  it('rollupNodes отдаёт own и childrenSum раздельно (для показа расхождения)', () => {
    const nodes = [
      node(['Г'], 0, { potr: 100 }),         // записано 100
      node(['Г', 'Р1'], 1, { potr: 30 }),
      node(['Г', 'Р2'], 1, { potr: 50 }),    // сумма детей 80 ≠ 100
    ];
    const cell = rollupNodes(nodes).get(nodePathKey(['Г']))!.potr;
    expect(cell.own).toBe(100);
    expect(cell.childrenSum).toBe(80);
    expect(cell.value).toBe(100); // own в приоритете
  });
});
