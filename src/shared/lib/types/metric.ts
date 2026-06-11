// shared/lib/types/metric.ts
// ─────────────────────────────────────────────────────────────
// Базовые контракты метрик, используемые за пределами entity
// (контракт дашборда, сервисы экспорта/импорта, ядро вычислений).
// ─────────────────────────────────────────────────────────────

/**
 * Функции агрегации для метрик.
 */
export type AggregateFunction =
  | 'SUM'             // Сумма
  | 'AVG'             // Среднее
  | 'MIN'             // Минимум
  | 'MAX'             // Максимум
  | 'COUNT'           // Количество
  | 'COUNT_DISTINCT'  // Количество уникальных
  | 'MEDIAN'          // Медиана
  | 'PERCENTILE';     // Перцентиль

/**
 * Тип метрики.
 */
export type MetricType =
  | 'aggregate'   // Агрегированная метрика (SUM, AVG, etc.)
  | 'calculated'; // Вычисляемая метрика (формула)

/**
 * Формат отображения значения.
 */
export type DisplayFormat =
  | 'number'      // 1234567.89
  | 'decimal'     // 1,234,567.89
  | 'percent'     // 12.34%
  | 'currency'    // $1,234.56
  | 'scientific'; // 1.23e+6

/**
 * Тип источника данных для метрики.
 */
export type MetricSourceType =
  | 'field'        // Прямое поле из Excel
  | 'metric';      // Другая метрика из той же группы

/**
 * Зависимость метрики от поля или другой метрики.
 */
export interface MetricDependency {
  type: MetricSourceType;
  alias: string;
  description?: string;
}
