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
