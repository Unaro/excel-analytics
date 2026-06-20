// shared/lib/utils/chart-domain.ts
// ─────────────────────────────────────────────────────────────
// Авто-домен радиальной оси радара.
//
// По умолчанию recharts берёт [0, auto] и округляет максимум до «красивого»,
// из-за чего малые величины (например доли < 1) схлопываются к центру и
// различия не видны. Здесь домен подгоняется под фактический диапазон
// значений с небольшим паддингом — радар «приближает» данные.
// ─────────────────────────────────────────────────────────────

/**
 * Возвращает [min, max] для PolarRadiusAxis по реальным значениям метрик.
 * undefined — числовых значений нет (оставить дефолт recharts).
 */
export function autoRadarDomain(values: number[]): [number, number] | undefined {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (min === Infinity) return undefined;

  if (min === max) {
    // Единственное значение — раздвигаем симметрично, чтобы точка не легла
    // ровно на край/центр.
    const pad = Math.abs(min) * 0.1 || 1;
    return [min - pad, max + pad];
  }

  const pad = (max - min) * 0.08;
  return [min - pad, max + pad];
}
