// entities/aggregate-nodes/lib/overlay.ts
// ─────────────────────────────────────────────────────────────
// Overlay введённых значений узлов файла-агрегата поверх вычисленных метрик.
// Чистые функции — переиспользуются страницей группы и дашбордом (мега-босс).
// ─────────────────────────────────────────────────────────────

import type { VirtualMetricValue } from '@/shared/lib/types/computation';
import { safeEvaluate } from '@/shared/lib/math/safe-math';

/**
 * Расчётная метрика для пересчёта по введённым значениям узла: формула шаблона
 * (`a/b`) + привязка её операндов-алиасов к колонкам (откуда брать введённое
 * значение в `values`).
 */
export interface EnteredCalcSpec {
  formula: string;
  /** Алиас формулы → имя колонки (значение операнда ищется в `values`). */
  operandColumns: Record<string, string>;
}

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
 * Расчётные метрики, посчитанные по ВВЕДЁННЫМ значениям узла: формула шаблона
 * вычисляется на введённых значениях операндов-колонок (а не по строкам-листьям).
 *
 * Зачем: в файлах-агрегатах метрики (итого/потребность) часто заданы ТОЛЬКО на
 * узлах («Итого»), листья пусты → SUM по листьям = null, и расчётная (итого/
 * потребность) тоже null. С введёнными значениями считаем её прямо из узла.
 *
 * Подменяем только когда ВСЕ операнды есть в узле — иначе оставляем вычисленное.
 */
export function enteredCalcVmValues(
  values: Record<string, number | null>,
  vms: ReadonlyArray<Pick<VirtualMetricValue, 'virtualMetricId' | 'sourceMetricId'>>,
  calcSpecByMetricId: Record<string, EnteredCalcSpec>
): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const vm of vms) {
    const spec = vm.sourceMetricId ? calcSpecByMetricId[vm.sourceMetricId] : undefined;
    if (!spec) continue;
    const scope: Record<string, number | null> = {};
    let resolvable = true;
    for (const [alias, col] of Object.entries(spec.operandColumns)) {
      if (!(col in values)) { resolvable = false; break; }
      scope[alias] = values[col];
    }
    if (!resolvable) continue;
    out[vm.virtualMetricId] = safeEvaluate(spec.formula, scope);
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
      // fromNode → UI подсвечивает ячейку как «введено из файла».
      return { ...vm, value: e, formattedValue: '—', fromNode: true };
    }
    return vm;
  });
  return changed ? out : vms;
}
