// entities/aggregate-nodes/lib/overlay.ts
// ─────────────────────────────────────────────────────────────
// Overlay введённых значений узлов файла-агрегата поверх вычисленных метрик.
// Чистые функции — переиспользуются страницей группы и дашбордом (мега-босс).
// ─────────────────────────────────────────────────────────────

import type { VirtualMetricValue } from '@/shared/lib/types/computation';
import type { AggregateNode } from '@/shared/lib/types/aggregate';
import { nodePathKey } from '@/shared/lib/types/aggregate';
import { safeEvaluate } from '@/shared/lib/math/safe-math';

/** Свёрнутое значение узла по одной колонке. */
export interface RolledCell {
  /** Итоговое: own ?? childrenSum (его берёт overlay). */
  value: number | null;
  /** Записанное в файле значение узла (может быть null). */
  own: number | null;
  /** Сумма rolled-up значений прямых детей (может быть null, если детей нет). */
  childrenSum: number | null;
}

/**
 * Rolled-up значения узлов с fallback вниз и разложением own/childrenSum.
 *
 * Для каждого узла по каждой колонке: СОБСТВЕННОЕ значение (`own`) в приоритете,
 * а если оно пусто (null) — СУММА rolled-up значений прямых детей (`childrenSum`),
 * которые сами добирают со своих детей (рекурсивно вниз). `value = own ?? sum`.
 *
 * `0` — реальное значение (не пусто): fallback срабатывает только на null/пусто.
 * `childrenSum` отдаётся отдельно, чтобы UI мог показать расхождение
 * «записано в файле vs сумма по детям». Ключи — nodePathKey (как у узлов).
 */
export function rollupNodes(
  nodes: ReadonlyArray<AggregateNode>
): Map<string, Record<string, RolledCell>> {
  const byKey = new Map<string, AggregateNode>();
  for (const n of nodes) byKey.set(nodePathKey(n.path), n);

  // Прямые дети: родитель = путь без последнего элемента (если такой узел есть).
  const childKeys = new Map<string, string[]>();
  for (const n of nodes) {
    if (n.path.length === 0) continue;
    const parentKey = nodePathKey(n.path.slice(0, -1));
    if (!byKey.has(parentKey)) continue;
    (childKeys.get(parentKey) ?? childKeys.set(parentKey, []).get(parentKey)!).push(
      nodePathKey(n.path)
    );
  }

  // Снизу вверх: глубокие уровни (бо́льший level) считаем первыми — к моменту
  // обработки родителя его дети уже свёрнуты.
  const order = [...nodes].sort((a, b) => b.level - a.level);
  const rolled = new Map<string, Record<string, RolledCell>>();
  for (const n of order) {
    const key = nodePathKey(n.path);
    const children = childKeys.get(key) ?? [];
    const out: Record<string, RolledCell> = {};
    for (const [col, own] of Object.entries(n.values)) {
      let sum = 0;
      let any = false;
      for (const ck of children) {
        const cv = rolled.get(ck)?.[col]?.value;
        if (cv != null) { sum += cv; any = true; }
      }
      const childrenSum = any ? sum : null;
      out[col] = { value: own != null ? own : childrenSum, own, childrenSum };
    }
    rolled.set(key, out);
  }
  return rolled;
}

/**
 * Свёрнутые значения узлов (только итог `value`) — для overlay-подстановки.
 * Тонкая обёртка над `rollupNodes`. Ключи — nodePathKey, поиск по пути.
 */
export function rollupNodeValues(
  nodes: ReadonlyArray<AggregateNode>
): Map<string, Record<string, number | null>> {
  const rich = rollupNodes(nodes);
  const out = new Map<string, Record<string, number | null>>();
  for (const [key, cells] of rich) {
    const v: Record<string, number | null> = {};
    for (const [col, cell] of Object.entries(cells)) v[col] = cell.value;
    out.set(key, v);
  }
  return out;
}

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
