import { describe, it, expect } from 'vitest';
import { resolveChartView, DEFAULT_CHART_VIEW } from './chart';

describe('resolveChartView', () => {
  it('нет chartView → дефолты', () => {
    const r = resolveChartView({});
    expect(r.chartTypes).toEqual(DEFAULT_CHART_VIEW.chartTypes);
    expect(r.seriesLimit).toBe(8);
    expect(r.paletteId).toBeUndefined();
  });

  it('null/undefined источник → дефолты, без падения', () => {
    expect(resolveChartView(null).seriesLimit).toBe(8);
    expect(resolveChartView(undefined).chartTypes).toEqual(DEFAULT_CHART_VIEW.chartTypes);
  });

  it('значения chartView перекрывают дефолты', () => {
    const r = resolveChartView({ chartView: { chartTypes: ['radar'], seriesLimit: 5 } });
    expect(r.chartTypes).toEqual(['radar']);
    expect(r.seriesLimit).toBe(5);
  });

  it('пустой chartTypes [] — осознанный выбор, дефолт НЕ подставляется', () => {
    expect(resolveChartView({ chartView: { chartTypes: [] } }).chartTypes).toEqual([]);
  });

  it('paletteId из chartView приоритетнее legacy group.paletteId', () => {
    const r = resolveChartView({ chartView: { paletteId: 'warm' }, paletteId: 'cool' });
    expect(r.paletteId).toBe('warm');
  });

  it('старая группа без chartView.paletteId → fallback на legacy paletteId', () => {
    const r = resolveChartView({ paletteId: 'cool' });
    expect(r.paletteId).toBe('cool');
  });
});
