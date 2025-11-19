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

/**
 * Результат анализа зависимостей метрик
 */
export interface DependencyAnalysis {
  metricId: string;
  dependencies: {
    type: 'field' | 'metric';
    alias: string;
    resolved: boolean;       // Привязка найдена
    targetId?: string;       // ID поля/метрики
    targetName?: string;     // Название для отображения
  }[];
  computationOrder: number;  // Порядок вычисления (топологическая сортировка)
  hasCircularDependency: boolean;
  circularPath?: string[];   // Путь циклической зависимости
}

/**
 * Результат валидации группы показателей
 */
export interface GroupValidationResult extends ValidationResult {
  groupId: string;
  groupName: string;
  
  // Анализ зависимостей для каждой метрики
  dependencyAnalysis: DependencyAnalysis[];
  
  // Метрики, готовые к вычислению
  validMetrics: string[];
  
  // Метрики с ошибками
  invalidMetrics: string[];
}
