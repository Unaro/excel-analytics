/**
 * Функции агрегации для метрик
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
 * Тип метрики
 */
export type MetricType = 
  | 'aggregate'   // Агрегированная метрика (SUM, AVG, etc.)
  | 'calculated'; // Вычисляемая метрика (формула)

/**
 * Формат отображения значения
 */
export type DisplayFormat = 
  | 'number'      // 1234567.89
  | 'decimal'     // 1,234,567.89
  | 'percent'     // 12.34%
  | 'currency'    // $1,234.56
  | 'scientific'; // 1.23e+6

/**
 * Тип источника данных для метрики
 */
export type MetricSourceType = 
  | 'field'        // Прямое поле из Excel
  | 'metric';      // Другая метрика из той же группы

/**
 * Зависимость метрики от поля или другой метрики
 */
export interface MetricDependency {
  type: MetricSourceType;
  alias: string;              // Имя в формуле (например, "revenue")
  
  // Для type='field'
  fieldAlias?: string;        // Алиас поля в группе
  
  // Для type='metric'
  metricAlias?: string;       // Алиас метрики в группе
  
  description?: string;
}

/**
 * Шаблон метрики (переиспользуемое определение)
 */
export interface MetricTemplate {
  id: string;
  name: string;
  description?: string;
  
  // Тип и вычисление
  type: MetricType;
  aggregateFunction?: AggregateFunction;  // Только для aggregate
  aggregateField?: string;                // Поле для агрегации
  formula?: string;                       // Только для calculated
  
  // Зависимости (извлекаются из формулы)
  dependencies: MetricDependency[];
  
  // Отображение
  displayFormat: DisplayFormat;
  decimalPlaces: number;
  prefix?: string;  // Префикс (например, "$")
  suffix?: string;  // Суффикс (например, "₽")
  
  // Метаданные
  createdAt: number;
  updatedAt: number;
}

/**
 * Привязка поля в контексте группы
 * Связывает алиас из формулы с реальной колонкой
 */
export interface FieldBinding {
  id: string;
  fieldAlias: string;   // Алиас, используемый в формуле (например, "revenue")
  columnName: string;   // Реальное название колонки в Excel
  description?: string;
}

/**
 * Привязка метрики (для calculated метрик, зависящих от других)
 */
export interface MetricBinding {
  id: string;
  metricAlias: string;  // Алиас в формуле (например, "total_revenue")
  metricId: string;     // ID метрики из этой же группы
  description?: string;
}

/**
 * Экземпляр метрики в группе показателей
 */
export interface GroupMetric {
  id: string;
  templateId: string;           // Ссылка на MetricTemplate
  
  // Переопределения (опционально)
  customName?: string;          // Переопределить название
  customDisplayFormat?: DisplayFormat;  // Переопределить формат
  customDecimalPlaces?: number; // Переопределить количество знаков
  
  // Привязки зависимостей
  fieldBindings: FieldBinding[];    // Привязка полей из Excel
  metricBindings: MetricBinding[];  // Привязка других метрик
  
  // Настройки
  enabled: boolean;             // Активна ли метрика
  order: number;                // Порядок вычисления (важно для зависимостей!)
  
  // Опционально: ключ для кеширования
  cacheKey?: string;
}

/**
 * Группа показателей (набор связанных метрик)
 */
export interface IndicatorGroup {
  id: string;
  name: string;
  description?: string;
  
  // Привязки полей для всей группы
  fieldMappings: FieldBinding[];
  
  // Метрики в группе (порядок важен для вычислений!)
  metrics: GroupMetric[];
  
  // Граф зависимостей (для валидации циклов)
  dependencyGraph?: {
    nodes: string[];  // ID метрик
    edges: { from: string; to: string }[];  // from зависит от to
  };
  
  // UI настройки
  color?: string;
  icon?: string;
  order: number;
  
  // Метаданные
  createdAt: number;
  updatedAt: number;
}
