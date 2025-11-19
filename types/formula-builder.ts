import { ColumnDataType } from './columns';
import { MetricDependency } from './metrics';
import { ValidationError } from './validation';

/**
 * Оператор в формуле
 */
export type FormulaOperator = 
  | '+'  | '-'  | '*'  | '/'  | '%'   // Арифметические
  | '('  | ')'                        // Группировка
  | '>'  | '<'  | '>=' | '<='         // Сравнение
  | '==' | '!='                       // Равенство
  | '&&' | '||'                       // Логические
  | 'IF' | 'MAX' | 'MIN' | 'ABS'      // Функции
  | 'ROUND' | 'CEIL' | 'FLOOR'
  | 'SQRT' | 'POW';

/**
 * Токен формулы
 */
export interface FormulaToken {
  type: 'field' | 'metric' | 'operator' | 'number' | 'function';
  value: string;
  position: number;
  length: number;
  
  // Для type='field' или 'metric'
  alias?: string;
  resolved?: boolean;      // Привязка найдена
  targetId?: string;       // ID поля/метрики
  targetType?: ColumnDataType;
}

/**
 * Разобранная формула
 */
export interface ParsedFormula {
  original: string;
  tokens: FormulaToken[];
  dependencies: MetricDependency[];
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Доступное поле для использования в формуле
 */
export interface AvailableField {
  alias: string;
  displayName: string;
  columnName: string;
  type: ColumnDataType;
  description?: string;
}

/**
 * Доступная метрика для использования в формуле
 */
export interface AvailableMetric {
  alias: string;
  displayName: string;
  metricId: string;
  metricName: string;
  order: number;  // Порядок вычисления
}

/**
 * Подсказка в конструкторе формул
 */
export interface FormulaSuggestion {
  type: 'field' | 'metric' | 'function' | 'operator';
  label: string;
  value: string;
  description?: string;
  insertText?: string;  // Что вставить при выборе
}

/**
 * Состояние конструктора формул
 */
export interface FormulaBuilderState {
  formula: string;
  parsedFormula: ParsedFormula | null;
  
  // Доступные источники данных
  availableFields: AvailableField[];
  availableMetrics: AvailableMetric[];
  
  // UI состояние
  cursorPosition: number;
  selectedToken?: FormulaToken;
  suggestions: FormulaSuggestion[];
  showSuggestions: boolean;
  
  // Валидация
  isValid: boolean;
  errors: ValidationError[];
}
