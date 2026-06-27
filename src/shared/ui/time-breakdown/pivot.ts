// ─────────────────────────────────────────────────────────────
// Чистая pivot-логика двумерного breakdown (категория × время).
//
// Вынесено из TimeBreakdownSection (ui.tsx), чтобы покрыть тестами без
// рендера React: сборка осей (даты/строки), сумма строки, нормализация
// ПО ПЕРИОДАМ (знаменатель по столбцу каждой даты) и доля ячейки.
// Поведение идентично прежним inline-useMemo — компонент теперь зовёт эти
// функции. Фаза 0 плана architecture/unified-view-config.md.
// ─────────────────────────────────────────────────────────────

import type { BreakdownItem } from '@/shared/lib/types/computation';
import {
  columnReference,
  normalizeValue,
  type NormalizeBase,
} from '@/shared/lib/utils/normalize';
import { safeEvaluate } from '@/shared/lib/math/safe-math';

/**
 * Спецификация расчётной метрики для корректного ИТОГА по строке: формула на
 * суммах операндов-метрик (Σa/Σb), а не сумма ячеек-долей. Применимо, когда
 * операнды — другие метрики строки (их значения есть в ячейках).
 */
export interface MetricCalcSpec {
  formula: string;
  /** alias формулы → virtualMetricId операнда (значение берётся из ячеек). */
  operandVmByAlias: Record<string, string>;
}

/**
 * Итог расчётной метрики по набору ячеек строки: суммируем каждый операнд по
 * ячейкам, затем вычисляем формулу. null — формула не посчиталась (деление на 0).
 */
export function evalCalcRowTotal(
  cells: Iterable<BreakdownItem>,
  spec: MetricCalcSpec
): number | null {
  // Материализуем: cells может быть одноразовым итератором (Map.values()),
  // а операндов несколько — иначе второй проход получит пусто.
  const arr = Array.from(cells);
  const scope: Record<string, number> = {};
  for (const [alias, vmId] of Object.entries(spec.operandVmByAlias)) {
    let sum = 0;
    for (const c of arr) {
      const v = metricValueOf(c, vmId);
      if (v !== null) sum += v;
    }
    scope[alias] = sum;
  }
  return safeEvaluate(spec.formula, scope);
}

export interface PivotRow {
  label: string;
  /** dateLabel → элемент breakdown */
  cells: Map<string, BreakdownItem>;
  /** Сумма выбранной метрики по строке (сортировка и top-N). */
  total: number;
}

/** Значение выбранной метрики в элементе breakdown (или null). */
export function metricValueOf(
  item: BreakdownItem | undefined,
  metricId: string
): number | null {
  const vm = item?.virtualMetrics.find((v) => v.virtualMetricId === metricId);
  return typeof vm?.value === 'number' ? vm.value : null;
}

/** Свёрнутый «хвост» Top-N второй оси — всегда последним столбцом. */
export const OTHER_LABEL = 'Прочее';

/**
 * Оси второй размерности: уникальные непустые метки, сортировка строковая
 * (даты — хронологически по формату, категории — по алфавиту). «Прочее»
 * (свёрнутый Top-N-хвост) всегда в конце.
 */
export function buildPivotDates(items: BreakdownItem[]): string[] {
  return Array.from(new Set(items.map((i) => i.dateLabel ?? '')))
    .filter(Boolean)
    .sort((a, b) => {
      if (a === OTHER_LABEL) return 1;
      if (b === OTHER_LABEL) return -1;
      return a < b ? -1 : a > b ? 1 : 0;
    });
}

/**
 * Строки pivot: группировка элементов по label, ячейки по dateLabel,
 * сумма выбранной метрики по строке. Сортировка по сумме (desc) — для top-N.
 * Элементы без dateLabel игнорируются (это 1-D-строки).
 */
export function buildPivotRows(
  items: BreakdownItem[],
  metricId: string,
  calcSpec?: MetricCalcSpec
): PivotRow[] {
  const byLabel = new Map<string, PivotRow>();
  for (const item of items) {
    if (!item.dateLabel) continue;
    let row = byLabel.get(item.label);
    if (!row) {
      row = { label: item.label, cells: new Map(), total: 0 };
      byLabel.set(item.label, row);
    }
    row.cells.set(item.dateLabel, item);
    // Простая (аддитивная) метрика — сумма ячеек. Расчётную считаем post-pass.
    if (!calcSpec) {
      const v = metricValueOf(item, metricId);
      if (v !== null) row.total += v;
    }
  }
  // Расчётная метрика: итог = формула на суммах операндов (Σa/Σb), не сумма долей.
  if (calcSpec) {
    for (const row of byLabel.values()) {
      row.total = evalCalcRowTotal(row.cells.values(), calcSpec) ?? 0;
    }
  }
  return Array.from(byLabel.values()).sort((a, b) => b.total - a.total);
}

/**
 * Нормализация ПО ПЕРИОДАМ: ориентир (знаменатель) на каждую дату — по столбцу
 * этой даты (сумма/макс/… по всем категориям внутри периода). Обобщает 1-D.
 * dateLabel → ориентир (или null, если посчитать нельзя).
 */
export function buildDateRefs(
  rows: PivotRow[],
  dates: string[],
  metricId: string,
  base: NormalizeBase
): Map<string, number | null> {
  const m = new Map<string, number | null>();
  for (const date of dates) {
    const col = rows.map((r) => metricValueOf(r.cells.get(date), metricId));
    m.set(date, columnReference(col, base));
  }
  return m;
}

/** Общий итог метрики — знаменатель Σ-столбца (доля строки в общем итоге). */
export function pivotGrandTotal(rows: PivotRow[]): number {
  return rows.reduce((s, r) => s + r.total, 0);
}

/**
 * Значение ячейки для показа/окраски/чарта: абсолют либо доля по периоду.
 * `dateRefs === null` (метрика не нормализуется) → абсолют.
 */
export function cellRatioOf(
  item: BreakdownItem | undefined,
  metricId: string,
  dateRefs: Map<string, number | null> | null
): number | null {
  const abs = metricValueOf(item, metricId);
  if (!dateRefs || abs === null) return abs;
  return normalizeValue(abs, dateRefs.get(item?.dateLabel ?? '') ?? null);
}
