// shared/lib/types/aggregate.ts
// Тип узла файла-агрегата (мега-босс, фаза 2). Живёт в shared, чтобы и фича
// импорта (извлечение), и entity-стор (хранение) могли его использовать без
// нарушения границ FSD. План: docs/architecture/aggregate-files.md

export interface AggregateNode {
  /** Путь значений ключевых колонок от корня до узла. */
  path: string[];
  /** Уровень = глубина в каскаде (индекс самого правого ключа). */
  level: number;
  /** Метка узла (последний элемент пути). */
  label: string;
  /** Это строка «Итого/Всего»? */
  isTotal: boolean;
  /** Введённые/предпосчитанные значения метрик по составному имени колонки. */
  values: Record<string, number | null>;
}

/** Стабильный ключ узла из пути. Разделитель U+0001 — чтобы ['a','b'] и
 *  ['ab'] не схлопывались в один ключ. */
export function nodePathKey(path: string[]): string {
  return path.join('');
}
