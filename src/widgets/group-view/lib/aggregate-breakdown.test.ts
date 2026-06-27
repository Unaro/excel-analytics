import { describe, it, expect } from 'vitest';
import { aggregateByLabel } from './aggregate-breakdown';
import type { BreakdownItem } from '@/entities/metric';
import type { MetricCalcSpec } from '@/shared/ui/time-breakdown/pivot';

const cell = (label: string, dateLabel: string, vals: Record<string, number | null>): BreakdownItem => ({
  label,
  dateLabel,
  recordCount: 1,
  virtualMetrics: Object.entries(vals).map(([virtualMetricId, value]) => ({
    virtualMetricId,
    virtualMetricName: virtualMetricId,
    value,
    formattedValue: String(value),
    sourceMetricId: virtualMetricId,
  })),
});

describe('aggregateByLabel', () => {
  const items = [
    cell('Р1', 'Янв', { a: 100, b: 50 }),
    cell('Р1', 'Фев', { a: 20, b: 30 }),
    cell('Р2', 'Янв', { a: 5, b: 5 }),
  ];

  it('простые метрики — сумма по категории', () => {
    const out = aggregateByLabel(items, {});
    const r1 = out.find((i) => i.label === 'Р1')!;
    expect(r1.virtualMetrics.find((v) => v.virtualMetricId === 'a')!.value).toBe(120);
    expect(r1.virtualMetrics.find((v) => v.virtualMetricId === 'b')!.value).toBe(80);
  });

  it('расчётная метрика — формула на суммах операндов (Σa/Σb), не сумма долей', () => {
    // обеспеченность = a/b: по строке Σa/Σb = 120/80 = 1.5 (а не (2+0.667)/2)
    const withCalc = [
      cell('Р1', 'Янв', { a: 100, b: 50, ob: 2 }),
      cell('Р1', 'Фев', { a: 20, b: 30, ob: 0.6667 }),
    ];
    const spec: Record<string, MetricCalcSpec> = {
      ob: { formula: 'a / b', operandVmByAlias: { a: 'a', b: 'b' } },
    };
    const out = aggregateByLabel(withCalc, spec);
    expect(out[0].virtualMetrics.find((v) => v.virtualMetricId === 'ob')!.value).toBeCloseTo(1.5);
  });

  it('одна запись на категорию, recordCount суммируется', () => {
    const out = aggregateByLabel(items, {});
    expect(out.find((i) => i.label === 'Р1')!.recordCount).toBe(2);
    expect(out.find((i) => i.label === 'Р2')!.recordCount).toBe(1);
  });
});
