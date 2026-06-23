// ─────────────────────────────────────────────────────────────
// Правило отображения формата на чартах при кросс-столбцовой нормализации.
//
// Нормализованная метрика (% от итога/макс/…) показывается на чарте процентом
// независимо от своего абсолютного формата: ось и тултип идут в масштабе %.
// Раньше это правило жило в трёх местах по-разному — инлайн в 2-D
// (time-breakdown) и через override displayFormat в 1-D (GroupViewContent и
// DashboardViewContent). Здесь — единый источник, чтобы пути не расходились.
//
// Масштаб (toDisplayScale) и подпись (formatDisplayValue) — в metric-colors.ts.
// Часть общего стиль-субстрата (architecture/unified-view-config.md, Фаза 1).
// ─────────────────────────────────────────────────────────────

/**
 * Эффективный формат метрики на чарте: нормализованная → `'percent'`,
 * иначе — её собственный формат (может быть undefined).
 */
export function effectiveChartFormat(
  displayFormat: string | undefined,
  isNormalized: boolean
): string | undefined {
  return isNormalized ? 'percent' : displayFormat;
}

/**
 * Конфиги метрик для чарта с учётом нормализации: у нормализованных метрик
 * (есть запись в `normalizeByVmId`) формат переопределяется на `'percent'`,
 * остальные — по ссылке. Пустая карта → исходный массив без копирования.
 * Используется 1-D-чартами (group-view и dashboard-view).
 */
export function buildNormalizedChartConfigs<T extends { id: string }>(
  configs: T[],
  normalizeByVmId: ReadonlyMap<string, unknown>
): T[] {
  if (normalizeByVmId.size === 0) return configs;
  return configs.map((vm) =>
    normalizeByVmId.has(vm.id) ? ({ ...vm, displayFormat: 'percent' } as T) : vm
  );
}
