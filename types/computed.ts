import { HierarchyFilterValue } from './hierarchy';
import { VirtualMetric } from './dashboards';

/**
 * Контекст вычисления метрики
 */
export interface ComputationContext {
  dashboardId: string;
  filters: HierarchyFilterValue[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}

/**
 * Вычисленное значение одной метрики
 */
export interface ComputedMetricValue {
  metricId: string;
  groupId: string;
  value: number | null;
  formattedValue: string;
  
  // Контекст вычисления
  context: ComputationContext;
  
  // Дополнительная информация
  recordCount: number;      // Количество записей в агрегации
  computedAt: number;       // Время вычисления
  
  // Для трендов
  previousValue?: number;
  change?: number;
  changePercent?: number;
  
  // Ошибка, если не удалось вычислить
  error?: string;
}

/**
 * Вычисленное значение виртуальной метрики для одной группы
 */
export interface VirtualMetricValue {
  virtualMetricId: string;
  virtualMetricName: string;       // "Загруженность"
  value: number | null;
  formattedValue: string;          // "85%"
  sourceMetricId: string;          // Какая метрика группы вычислила это значение
  error?: string;
}

/**
 * Результат вычислений для одной группы показателей
 */
export interface GroupComputationResult {
  groupId: string;
  groupName: string;
  
  // Значения виртуальных метрик
  virtualMetrics: VirtualMetricValue[];
  
  // Все метрики группы (если нужно показывать)
  allMetrics?: ComputedMetricValue[];
  
  // Мета-информация
  recordCount: number;
  computedAt: number;
}

/**
 * Активное значение иерархического фильтра
 * (текущий выбор пользователя)
 */
export interface ActiveHierarchyFilter {
  levelName: string;      // Название уровня ("Город")
  levelId: string;        // ID уровня из HierarchyLevel
  columnName: string;     // Название колонки ("Город")
  value: string;          // Выбранное значение ("Москва")
  displayValue: string;   // Для отображения ("г. Москва")
  depth: number;          // Глубина вложенности (0 = верхний уровень)
}

/**
 * Результат вычислений для всего дашборда
 */
export interface DashboardComputationResult {
  dashboardId: string;
  
  // Полный путь фильтрации (Россия → Москва → Центральный район)
  hierarchyFilters: HierarchyFilterValue[];
  
  // Активный фильтр (самый глубокий уровень = Центральный район)
  activeFilter: ActiveHierarchyFilter | null;
  
  // Виртуальные метрики дашборда
  virtualMetrics: VirtualMetric[];
  
  // Результаты для каждой группы (строки таблицы)
  groups: GroupComputationResult[];
  
  // Общая информация
  totalRecords: number;   // Всего записей после фильтрации
  computedAt: number;    // Время вычисления
  computationTime: number; // Время вычисления в мс
}

/**
 * Кеш вычисленных значений
 */
export interface MetricCache {
  key: string;              // Уникальный ключ кеша
  value: ComputedMetricValue;
  expiresAt: number;        // Время истечения кеша
}

/**
 * Результат вычисления для виджета
 */
export interface WidgetComputationResult {
  widgetId: string;
  
  // Для indicator_groups виджета
  groups?: GroupComputationResult[];
  
  // Для chart виджета
  chartData?: {
    labels: string[];
    datasets: {
      label: string;
      metricId: string;
      groupId: string;
      values: number[];
      color?: string;
    }[];
  };
  
  // Для metric виджета
  metricValue?: ComputedMetricValue;
  
  error?: string;
  computedAt: number;
}
