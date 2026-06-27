import { describe, it, expect } from 'vitest';
import { buildTreemapData } from './build-treemap-data';
import type { BreakdownItem } from '@/entities/metric';

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

describe('buildTreemapData', () => {
  const data = [
    item('А', { m: 100 }),
    item('Б', { m: 0 }),
    item('В', { m: -5 }),
    item('Г', { m: null }),
    item('Д', { m: 40 }),
  ];

  it('берёт только положительные значения метрики', () => {
    expect(buildTreemapData(data, 'm')).toEqual([
      { name: 'А', value: 100 },
      { name: 'Д', value: 40 },
    ]);
  });

  it('percent: значения масштабируются ×100 (как бары)', () => {
    const d = [item('P', { share: 0.6 }), item('Q', { share: 0 })];
    expect(buildTreemapData(d, 'share', 'percent')).toEqual([{ name: 'P', value: 60 }]);
  });

  it('неизвестная метрика → пусто', () => {
    expect(buildTreemapData(data, 'нет')).toEqual([]);
  });
});
