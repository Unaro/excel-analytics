// Тепловая карта 2-D: окраска ячеек pivot (категория×время) по интенсивности
// значения. Чистые функции — тестируются отдельно.

export interface HeatmapExtent {
  min: number;
  max: number;
}

/** Мин/макс по непустым числам. null — нет валидных значений (пустой экстент). */
export function heatmapExtent(values: ReadonlyArray<number | null | undefined>): HeatmapExtent | null {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v == null || Number.isNaN(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return min === Infinity ? null : { min, max };
}

/**
 * Цвет фона ячейки по значению в экстенте: единичный hue с альфа-рампом
 * (тема-агностично, рисуется поверх фона ячейки). `t = (v−min)/(max−min)`,
 * clamp 0..1; при `min==max` все ячейки получают `t=0` (слабый ровный фон).
 * `null`/пустой экстент → `undefined` (фон не задаётся).
 */
export function heatmapColor(
  value: number | null | undefined,
  extent: HeatmapExtent | null
): string | undefined {
  if (value == null || Number.isNaN(value) || !extent) return undefined;
  const span = extent.max - extent.min;
  const t = span > 0 ? Math.min(1, Math.max(0, (value - extent.min) / span)) : 0;
  const alpha = 0.06 + 0.64 * t;
  return `rgba(99, 102, 241, ${alpha.toFixed(3)})`;
}
