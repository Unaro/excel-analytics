// ─────────────────────────────────────────────────────────────
// Единый источник цветов серий чартов. Две роли — две палитры:
//  - METRIC_SERIES_COLORS: серии = метрики (1-D bar/radar), обычно немного.
//  - CATEGORY_SERIES_COLORS: серии = категории (2-D top-N), нужно больше цветов.
//
// Значения сохранены ровно как были (раньше — 4 копии 5-цветного COLORS в
// чартах + SERIES_COLORS в time-breakdown), смены поведения нет. Параметризация
// выбора палитры пользователем — Фаза 3 плана architecture/unified-view-config.md.
// ─────────────────────────────────────────────────────────────

/** Серии = метрики (1-D): bar/radar в group-view и charts-section. */
export const METRIC_SERIES_COLORS: string[] = [
  '#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444',
];

/** Серии = категории (2-D pivot, top-N): нужен запас цветов. */
export const CATEGORY_SERIES_COLORS: string[] = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6',
  '#a855f7', '#64748b',
];

/** Цвет серии по индексу с цикличным переполнением палитры. */
export function seriesColorAt(palette: readonly string[], index: number): string {
  return palette[index % palette.length];
}
