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

// ─────────────────────────────────────────────────────────────
// Курируемые палитры (Фаза 3). Выбор хранится на группе показателей
// (IndicatorGroup.paletteId) и красит серии чартов этой группы — и 1-D
// (метрики), и 2-D (категории). ДЕФОЛТ (нет paletteId или 'default') НЕ
// меняет текущие цвета: 1-D берёт METRIC_SERIES_COLORS, 2-D —
// CATEGORY_SERIES_COLORS (см. metricPalette/categoryPalette). Именованные
// палитры — единый упорядоченный список для обеих ролей.
// ─────────────────────────────────────────────────────────────

export interface ChartPalette {
  id: string;
  name: string;
  colors: string[];
}

export const DEFAULT_PALETTE_ID = 'default';

/** Палитры в порядке показа. Первая — «Стандартная» (= текущие дефолты). */
export const CHART_PALETTES: ChartPalette[] = [
  // Превью «Стандартной» = категориальная (12 цветов); фактические дефолты
  // по ролям отдаёт metricPalette/categoryPalette (см. ниже).
  { id: DEFAULT_PALETTE_ID, name: 'Стандартная', colors: CATEGORY_SERIES_COLORS },
  {
    id: 'warm',
    name: 'Тёплая',
    colors: [
      '#ef4444', '#f97316', '#f59e0b', '#eab308', '#ec4899',
      '#dc2626', '#fb7185', '#fbbf24', '#fda4af', '#c2410c',
      '#d946ef', '#a16207',
    ],
  },
  {
    id: 'cool',
    name: 'Холодная',
    colors: [
      '#6366f1', '#06b6d4', '#10b981', '#3b82f6', '#8b5cf6',
      '#14b8a6', '#0ea5e9', '#22c55e', '#0d9488', '#4f46e5',
      '#2dd4bf', '#7c3aed',
    ],
  },
  {
    id: 'pastel',
    name: 'Пастель',
    colors: [
      '#a5b4fc', '#6ee7b7', '#fcd34d', '#fca5a5', '#c4b5fd',
      '#67e8f9', '#f9a8d4', '#bef264', '#fdba74', '#5eead4',
      '#d8b4fe', '#cbd5e1',
    ],
  },
  {
    id: 'contrast',
    name: 'Контраст',
    colors: [
      '#4f46e5', '#16a34a', '#ea580c', '#dc2626', '#9333ea',
      '#0891b2', '#db2777', '#65a30d', '#c026d3', '#0d9488',
      '#ca8a04', '#475569',
    ],
  },
];

function paletteColors(paletteId: string | undefined): string[] | null {
  if (!paletteId || paletteId === DEFAULT_PALETTE_ID) return null;
  return CHART_PALETTES.find((p) => p.id === paletteId)?.colors ?? null;
}

/** Палитра для 1-D (серии=метрики). Дефолт → METRIC_SERIES_COLORS. */
export function metricPalette(paletteId?: string): string[] {
  return paletteColors(paletteId) ?? METRIC_SERIES_COLORS;
}

/** Палитра для 2-D (серии=категории). Дефолт → CATEGORY_SERIES_COLORS. */
export function categoryPalette(paletteId?: string): string[] {
  return paletteColors(paletteId) ?? CATEGORY_SERIES_COLORS;
}
