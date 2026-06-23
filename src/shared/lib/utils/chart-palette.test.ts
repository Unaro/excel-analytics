import { describe, it, expect } from 'vitest';
import {
  METRIC_SERIES_COLORS,
  CATEGORY_SERIES_COLORS,
  CHART_PALETTES,
  DEFAULT_PALETTE_ID,
  seriesColorAt,
  metricPalette,
  categoryPalette,
} from './chart-palette';

describe('seriesColorAt', () => {
  it('берёт цвет по индексу и зацикливается', () => {
    const p = ['a', 'b', 'c'];
    expect(seriesColorAt(p, 0)).toBe('a');
    expect(seriesColorAt(p, 2)).toBe('c');
    expect(seriesColorAt(p, 3)).toBe('a'); // overflow
    expect(seriesColorAt(p, 7)).toBe('b');
  });
});

describe('metricPalette / categoryPalette — дефолт сохраняет текущие цвета', () => {
  it('нет paletteId → роль-дефолт (без смены поведения)', () => {
    expect(metricPalette(undefined)).toBe(METRIC_SERIES_COLORS);
    expect(categoryPalette(undefined)).toBe(CATEGORY_SERIES_COLORS);
  });
  it("'default' → роль-дефолт", () => {
    expect(metricPalette(DEFAULT_PALETTE_ID)).toBe(METRIC_SERIES_COLORS);
    expect(categoryPalette(DEFAULT_PALETTE_ID)).toBe(CATEGORY_SERIES_COLORS);
  });
  it('неизвестный id → роль-дефолт (фолбэк)', () => {
    expect(metricPalette('nope')).toBe(METRIC_SERIES_COLORS);
    expect(categoryPalette('nope')).toBe(CATEGORY_SERIES_COLORS);
  });
  it('именованная палитра → её цвета для обеих ролей', () => {
    const warm = CHART_PALETTES.find(p => p.id === 'warm')!;
    expect(metricPalette('warm')).toBe(warm.colors);
    expect(categoryPalette('warm')).toBe(warm.colors);
  });
});

describe('CHART_PALETTES', () => {
  it('первая — «Стандартная» с id default', () => {
    expect(CHART_PALETTES[0].id).toBe(DEFAULT_PALETTE_ID);
  });
  it('у каждой палитры непустой список цветов и уникальный id', () => {
    const ids = new Set<string>();
    for (const p of CHART_PALETTES) {
      expect(p.colors.length).toBeGreaterThan(0);
      expect(ids.has(p.id)).toBe(false);
      ids.add(p.id);
    }
  });
});
