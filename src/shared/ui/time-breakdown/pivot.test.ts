import { describe, it, expect } from 'vitest';
import type { BreakdownItem, VirtualMetricValue } from '@/shared/lib/types/computation';
import {
  metricValueOf,
  buildPivotDates,
  buildPivotRows,
  buildDateRefs,
  pivotGrandTotal,
  cellRatioOf,
} from './pivot';

// ── фикстуры ──────────────────────────────────────────────────
function vm(id: string, value: number | null): VirtualMetricValue {
  return {
    virtualMetricId: id,
    virtualMetricName: id,
    value,
    formattedValue: value === null ? '—' : String(value),
    sourceMetricId: id,
  };
}
function item(
  label: string,
  dateLabel: string | undefined,
  metrics: VirtualMetricValue[]
): BreakdownItem {
  return { label, dateLabel, recordCount: 0, virtualMetrics: metrics };
}

// Базовый набор: A/B × 2 периода + одна 1-D строка C (без dateLabel).
const ITEMS: BreakdownItem[] = [
  item('A', '2024-01', [vm('m1', 10)]),
  item('A', '2024-02', [vm('m1', 20)]),
  item('B', '2024-01', [vm('m1', 30)]),
  item('B', '2024-02', [vm('m1', 40)]),
  item('C', undefined, [vm('m1', 5)]), // 1-D — игнорируется pivot
];

describe('metricValueOf', () => {
  it('возвращает число выбранной метрики', () => {
    expect(metricValueOf(item('A', '2024-01', [vm('m1', 10)]), 'm1')).toBe(10);
  });
  it('null для отсутствующей метрики / null-значения / undefined item', () => {
    expect(metricValueOf(item('A', '2024-01', [vm('m1', 10)]), 'm2')).toBeNull();
    expect(metricValueOf(item('A', '2024-01', [vm('m1', null)]), 'm1')).toBeNull();
    expect(metricValueOf(undefined, 'm1')).toBeNull();
  });
});

describe('buildPivotDates', () => {
  it('уникальные непустые даты, отсортированы, без 1-D строк', () => {
    expect(buildPivotDates(ITEMS)).toEqual(['2024-01', '2024-02']);
  });
  it('пустой массив без дат', () => {
    expect(buildPivotDates([item('A', undefined, [vm('m1', 1)])])).toEqual([]);
  });
  it('«Прочее» (свёрнутый Top-N) всегда последним', () => {
    const items = [
      item('X', 'Прочее', [vm('m1', 1)]),
      item('X', 'Бета', [vm('m1', 1)]),
      item('X', 'Альфа', [vm('m1', 1)]),
    ];
    expect(buildPivotDates(items)).toEqual(['Альфа', 'Бета', 'Прочее']);
  });
});

describe('buildPivotRows: calc-итог', () => {
  it('расчётная метрика: total = формула на суммах операндов (а не сумма ячеек)', () => {
    const items = [
      item('Р1', 'Янв', [vm('a', 100), vm('b', 50)]),
      item('Р1', 'Фев', [vm('a', 20), vm('b', 30)]),
    ];
    const rows = buildPivotRows(items, 'ob', { formula: 'a / b', operandVmByAlias: { a: 'a', b: 'b' } });
    // Σa/Σb = 120/80 = 1.5
    expect(rows[0].total).toBeCloseTo(1.5);
  });
});

describe('buildPivotRows', () => {
  it('группирует по label, ячейки по дате, сумма метрики, сортировка по сумме desc', () => {
    const rows = buildPivotRows(ITEMS, 'm1');
    expect(rows.map(r => r.label)).toEqual(['B', 'A']); // B=70 > A=30
    expect(rows.map(r => r.total)).toEqual([70, 30]);
    const a = rows.find(r => r.label === 'A')!;
    expect(a.cells.get('2024-01')?.virtualMetrics[0].value).toBe(10);
    expect(a.cells.get('2024-02')?.virtualMetrics[0].value).toBe(20);
  });
  it('игнорирует строки без dateLabel (C не попадает)', () => {
    const rows = buildPivotRows(ITEMS, 'm1');
    expect(rows.find(r => r.label === 'C')).toBeUndefined();
  });
  it('null-значения не вливаются в сумму строки', () => {
    const rows = buildPivotRows(
      [item('A', '2024-01', [vm('m1', null)]), item('A', '2024-02', [vm('m1', 7)])],
      'm1'
    );
    expect(rows[0].total).toBe(7);
    expect(rows[0].cells.size).toBe(2); // ячейка с null всё равно сохранена
  });
});

describe('buildDateRefs (нормализация по периодам)', () => {
  const rows = buildPivotRows(ITEMS, 'm1');
  const dates = buildPivotDates(ITEMS);
  it('total: сумма по столбцу каждой даты', () => {
    const refs = buildDateRefs(rows, dates, 'm1', 'total');
    expect(refs.get('2024-01')).toBe(40); // 10 + 30
    expect(refs.get('2024-02')).toBe(60); // 20 + 40
  });
  it('max / min / mean по столбцу даты', () => {
    expect(buildDateRefs(rows, dates, 'm1', 'max').get('2024-01')).toBe(30);
    expect(buildDateRefs(rows, dates, 'm1', 'min').get('2024-01')).toBe(10);
    expect(buildDateRefs(rows, dates, 'm1', 'mean').get('2024-01')).toBe(20); // (10+30)/2
  });
});

describe('pivotGrandTotal', () => {
  it('сумма итогов всех строк', () => {
    expect(pivotGrandTotal(buildPivotRows(ITEMS, 'm1'))).toBe(100);
  });
});

describe('cellRatioOf', () => {
  const rows = buildPivotRows(ITEMS, 'm1');
  const dates = buildPivotDates(ITEMS);
  const a01 = rows.find(r => r.label === 'A')!.cells.get('2024-01');

  it('dateRefs === null → абсолют', () => {
    expect(cellRatioOf(a01, 'm1', null)).toBe(10);
  });
  it('нормализация по периоду total: 10/40 = 0.25', () => {
    const refs = buildDateRefs(rows, dates, 'm1', 'total');
    expect(cellRatioOf(a01, 'm1', refs)).toBeCloseTo(0.25);
  });
  it('нормализация max: 10/30', () => {
    const refs = buildDateRefs(rows, dates, 'm1', 'max');
    expect(cellRatioOf(a01, 'm1', refs)).toBeCloseTo(10 / 30);
  });
  it('деление на нулевой ориентир → null', () => {
    const zRows = buildPivotRows(
      [item('A', 'd', [vm('m1', 0)]), item('B', 'd', [vm('m1', 0)])],
      'm1'
    );
    const refs = buildDateRefs(zRows, ['d'], 'm1', 'total'); // ref = 0
    expect(cellRatioOf(zRows[0].cells.get('d'), 'm1', refs)).toBeNull();
  });
  it('отсутствующее значение → null даже при валидном ориентире', () => {
    const refs = buildDateRefs(rows, dates, 'm1', 'total');
    expect(cellRatioOf(item('Z', '2024-01', [vm('m1', null)]), 'm1', refs)).toBeNull();
  });
});
