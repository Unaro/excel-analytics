/**
 * Типы ошибок валидации
 */
export type ValidationErrorType = 
  | 'COLUMN_NOT_FOUND'        // Колонка не найдена
  | 'INVALID_FORMULA'         // Неверный синтаксис формулы
  | 'CIRCULAR_DEPENDENCY'     // Циклическая зависимость метрик
  | 'METRIC_NOT_FOUND'        // Метрика-зависимость не найдена
  | 'UNRESOLVED_DEPENDENCY'   // Зависимость не привязана
  | 'TYPE_MISMATCH'           // Несоответствие типов
  | 'MISSING_BINDING'         // Отсутствует привязка
  | 'HIERARCHY_INVALID'       // Некорректная иерархия
  | 'DUPLICATE_ALIAS'         // Дублирование алиаса
  | 'INVALID_AGGREGATION';    // Некорректная агрегация

/**
 * Ошибка валидации
 */
export interface ValidationError {
  type: ValidationErrorType;
  message: string;
  field?: string;
  metricId?: string;           // ID проблемной метрики
  dependencyAlias?: string;    // Алиас проблемной зависимости
  context?: Record<string, unknown>;
}

/**
 * Результат валидации
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings?: ValidationError[];
}
