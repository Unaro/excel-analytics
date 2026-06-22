// entities/metric/lib/normalize.ts
// ─────────────────────────────────────────────────────────────
// Кросс-столбцовая нормализация результата (пост-обработка). Значение каждой
// строки делится на ориентир по столбцу текущего представления. Чистые
// функции — знаменатель и нормализация считаются на рендере, нигде не хранятся.
// Показ процентом делает displayFormat (значение остаётся долей value/база).
// ─────────────────────────────────────────────────────────────

import type { VirtualMetricValue } from '@/shared/lib/types/computation';

/** Ориентир (знаменатель) нормализации по столбцу. */
export type NormalizeBase = 'total' | 'max' | 'min' | 'mean';

function finiteNumbers(values: ReadonlyArray<number | null | undefined>): number[] {
  return values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
}

/**
 * Ориентир (знаменатель) по столбцу значений. `null`, если посчитать нельзя
 * (нет конечных чисел).
 */
export function columnReference(
  values: ReadonlyArray<number | null | undefined>,
  base: NormalizeBase
): number | null {
  const nums = finiteNumbers(values);
  if (nums.length === 0) return null;
  switch (base) {
    case 'total':
      return nums.reduce((a, b) => a + b, 0);
    case 'max':
      return Math.max(...nums);
    case 'min':
      return Math.min(...nums);
    case 'mean':
      return nums.reduce((a, b) => a + b, 0) / nums.length;
  }
}

/**
 * Нормализованное значение = `value / ref`. `null` при отсутствии значения или
 * нулевом/отсутствующем ориентире (деление на 0 → `null`, а не `Infinity`).
 */
export function normalizeValue(value: number | null | undefined, ref: number | null): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (ref == null || ref === 0) return null;
  return value / ref;
}

/**
 * Нормализует столбец значений по выбранному ориентиру за один проход.
 * Порядок и длина сохраняются (соответствие строкам столбца).
 */
export function normalizeColumn(
  values: ReadonlyArray<number | null | undefined>,
  base: NormalizeBase
): (number | null)[] {
  const ref = columnReference(values, base);
  return values.map((v) => normalizeValue(v, ref));
}

/**
 * Нормализует столбцы матрицы значений (ряды × метрики) по базам на метрику.
 * `baseByVmId`: `virtualMetricId` → база (нет записи = метрика не нормализуется).
 * Знаменатель каждого столбца считается по `rows` (= столбец текущего вида).
 * Возвращает новые ряды: для нормализуемых метрик `value` = доля, а
 * `formattedValue` = `'—'` (триггер переформата в ячейке по displayFormat).
 * Ряды без затронутых метрик возвращаются по ссылке (стабильность для memo).
 */
export function normalizeVmRows<T extends { virtualMetrics: VirtualMetricValue[] }>(
  rows: T[],
  baseByVmId: Map<string, NormalizeBase>
): T[] {
  if (baseByVmId.size === 0 || rows.length === 0) return rows;
  // Доли по каждому нормализуемому столбцу (в порядке rows).
  const ratiosByVm = new Map<string, (number | null)[]>();
  for (const [vmId, base] of baseByVmId) {
    const col = rows.map((r) => r.virtualMetrics.find((v) => v.virtualMetricId === vmId)?.value ?? null);
    ratiosByVm.set(vmId, normalizeColumn(col, base));
  }
  return rows.map((r, i) => {
    let changed = false;
    const vms = r.virtualMetrics.map((v) => {
      const ratios = ratiosByVm.get(v.virtualMetricId);
      if (!ratios) return v;
      changed = true;
      return { ...v, value: ratios[i], formattedValue: '—' };
    });
    return changed ? { ...r, virtualMetrics: vms } : r;
  });
}
