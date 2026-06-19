// shared/lib/computation/lib/aggregate-functions.ts
// ─────────────────────────────────────────────────────────────
// Единый список агрегатных функций, распознаваемых в формулах.
// Лист-модуль без тяжёлых зависимостей (mathjs): импортируется и
// препроцессором формул, и Zod-схемами server-actions, и UI-билдером —
// чтобы список не дублировался и не расходился.
// ─────────────────────────────────────────────────────────────

/** Агрегатные функции, распознаваемые в формулах. */
export const AGGREGATE_FUNCTIONS = [
  'SUM', 'AVG', 'MIN', 'MAX', 'COUNT', 'COUNT_DISTINCT', 'MEDIAN',
] as const;

export type AggregateFn = (typeof AGGREGATE_FUNCTIONS)[number];
