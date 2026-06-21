// entities/aggregate-nodes/lib/overlay.ts
// ─────────────────────────────────────────────────────────────
// Overlay введённых значений узлов файла-агрегата поверх вычисленных метрик.
// Чистые функции — переиспользуются страницей группы и дашбордом (мега-босс).
// ─────────────────────────────────────────────────────────────

import type { VirtualMetricValue } from '@/shared/lib/types/computation';

/**
 * Введённые значения узла (`values`: имя колонки → число) → карта
 * virtualMetricId → значение, по привязке метрики к колонке
 * (`sourceMetricId` метрики → её columnName в `columnByMetricId`).
 */
export function enteredVmValues(
  values: Record<string, number | null>,
  vms: ReadonlyArray<Pick<VirtualMetricValue, 'virtualMetricId' | 'sourceMetricId'>>,
  columnByMetricId: Record<string, string>
): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const vm of vms) {
    const col = vm.sourceMetricId ? columnByMetricId[vm.sourceMetricId] : undefined;
    if (col && col in values) out[vm.virtualMetricId] = values[col];
  }
  return out;
}

/**
 * Подставляет введённые значения ВМЕСТО вычисленных: где у узла есть введённое
 * значение (не null), оно перекрывает значение метрики («официальная» цифра из
 * файла). formattedValue → '—', чтобы потребитель переформатировал из value —
 * так форматирование, окрашивание и сортировка работают на введённых числах.
 * Метрики без введённого значения не трогаем.
 */
export function mergeEnteredVms(
  vms: VirtualMetricValue[],
  entered: Record<string, number | null> | undefined
): VirtualMetricValue[] {
  if (!entered) return vms;
  let changed = false;
  const out = vms.map(vm => {
    const e = entered[vm.virtualMetricId];
    if (e != null) {
      changed = true;
      return { ...vm, value: e, formattedValue: '—' };
    }
    return vm;
  });
  return changed ? out : vms;
}
