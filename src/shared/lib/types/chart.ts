/**
 * Тип графика
 */
export type ChartType = 
    | 'bar'       // Столбчатая диаграмма
    | 'radar';    // Радарная диаграмма
//  | 'pie'       // Круговая диаграмма
//  | 'area'      // Диаграмма с областями
//  | 'scatter'   // Точечная диаграмма
//  | 'line'      // Линейный график


export type ChartMode = 'single' | 'multi';

// ─────────────────────────────────────────────────────────────
// Стиль отображения метрики на чарте «Столбцы» (composed: столбцы + линии).
// Расширяемо: на будущее — заливка/толщина/маркеры и т.п.
// ─────────────────────────────────────────────────────────────

/** Метрика рисуется столбцом или линией. */
export type MetricChartKind = 'bar' | 'line';
/** Тип кривой линии: гладкая (monotone) или ломаная (linear). */
export type LineCurve = 'smooth' | 'linear';
/** Штрих линии: сплошная или пунктир. */
export type LineDash = 'solid' | 'dashed';

export interface MetricChartStyle {
  kind: MetricChartKind;
  /** Только для line: тип кривой. По умолчанию 'smooth'. */
  curve?: LineCurve;
  /** Только для line: штрих. По умолчанию 'solid'. */
  dash?: LineDash;
}

/** Стиль по умолчанию — столбец (обратная совместимость). */
export const DEFAULT_METRIC_CHART_STYLE: MetricChartStyle = { kind: 'bar' };

// ─────────────────────────────────────────────────────────────
// Единый View-config: сериализуемые настройки ВИДА чартов группы, которые
// читают оба пути (1-D метрики-серии и 2-D категории×время). Хранится на
// IndicatorGroup.chartView. Все поля опциональны → старые группы читаются с
// дефолтами (back-compat). chartStyle метрик НЕ здесь — он per-metric в
// group-metric-config. См. docs/architecture/unified-view-config.md (Фаза 2).
// ─────────────────────────────────────────────────────────────

export interface ChartViewConfig {
  /** 1-D: какие типы чартов показывать (bar | radar, на будущее area/…). */
  chartTypes?: ChartType[];
  /** 2-D: сколько серий (top-N) на чарте по умолчанию. */
  seriesLimit?: number;
  /** Палитра серий (id из CHART_PALETTES). Новый home для paletteId. */
  paletteId?: string;
}

/**
 * Дефолты вида чартов (как было до персиста). Линия/столбцы 2-D НЕ здесь —
 * вид задаёт chartStyle.kind выбранной метрики (единый контрол на KPI-карточке).
 */
export const DEFAULT_CHART_VIEW = {
  chartTypes: ['bar', 'radar'] as ChartType[],
  seriesLimit: 8,
};

/** Источник настроек: группа с новым chartView и legacy-полем paletteId. */
export interface ChartViewSource {
  chartView?: ChartViewConfig;
  /** @deprecated читается как fallback для групп без chartView.paletteId. */
  paletteId?: string;
}

/** Вид с заполненными дефолтами (paletteId может быть undefined → дефолт палитры). */
export interface ResolvedChartView {
  chartTypes: ChartType[];
  seriesLimit: number;
  paletteId?: string;
}

/**
 * Эффективный вид чартов группы: значения из `chartView` или дефолты. paletteId
 * берётся из `chartView.paletteId`, иначе из legacy `group.paletteId` (старые
 * группы не теряют выбранную палитру). Пустой `chartTypes: []` — осознанный
 * выбор «без чартов», дефолт подставляется только при отсутствии (undefined).
 */
export function resolveChartView(src: ChartViewSource | null | undefined): ResolvedChartView {
  const cv = src?.chartView;
  return {
    chartTypes: cv?.chartTypes ?? DEFAULT_CHART_VIEW.chartTypes,
    seriesLimit: cv?.seriesLimit ?? DEFAULT_CHART_VIEW.seriesLimit,
    paletteId: cv?.paletteId ?? src?.paletteId,
  };
}
