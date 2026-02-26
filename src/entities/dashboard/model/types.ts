// types/dashboards.ts
import { HierarchyFilterValue } from '@/entities/hierarchy/model/types';
import { DisplayFormat } from '@/entities/metric/model/types';


export interface KPIWidget {
  id: string;
  templateId: string;           // Ссылка на шаблон
  bindings: Record<string, string>; // Привязка переменных:
                                    // Для Aggregate Template: variable -> columnAlias
                                    // Для Calculated Template: variable -> otherWidgetId
  
  // Переопределения визуализации
  customName?: string;          // Если хотим переименовать
  color?: 'indigo' | 'emerald' | 'rose' | 'amber' | 'blue';
}

// Доступные цвета (ключи)
export type MetricColor = 'emerald' | 'rose' | 'amber' | 'blue' | 'indigo' | 'slate';

// Операторы сравнения
export type ConditionOperator = '>' | '>=' | '<' | '<=' | '==' | '!=' | 'between';;

// Правило форматирования
export interface FormattingRule {
  id: string;
  operator: ConditionOperator;
  value: number;
  value2?: number;
  color: MetricColor;
}

export interface ColorConfig {
  rules: FormattingRule[]; 
}


/**
 * Виртуальная метрика - общий показатель для всех групп
 * Каждая группа вычисляет его по своей формуле
 */
export interface VirtualMetric {
  id: string;
  name: string;                    // "Загруженность"
  description?: string;
  displayFormat: DisplayFormat;    // 'percent'
  decimalPlaces: number;           // 1
  unit?: string;                   // "%"
  order: number;                   // Порядок колонки в таблице

  colorConfig?: ColorConfig;        // Настройки цветового форматирования
}

/**
 * Тип виджета
 */
export type WidgetType = 
  | 'metric'           // Карточка с одной метрикой
  | 'chart'            // График
  | 'table'            // Обычная таблица данных
  | 'indicator_groups' // Таблица с группами показателей
  | 'text';            // Текстовый блок

/**
 * Тип графика
 */
export type ChartType = 
  | 'line'      // Линейный график
  | 'bar'       // Столбчатая диаграмма
  | 'pie'       // Круговая диаграмма
  | 'area'      // Диаграмма с областями
  | 'scatter'   // Точечная диаграмма
  | 'radar';    // Радарная диаграмма

/**
 * Настройки графика
 */
export interface ChartConfig {
  chartType: ChartType;
  
  // Источник данных
  groupIds: string[];       // Какие группы показателей использовать
  metricIds: string[];      // Какие метрики отображать
  
  // Оси
  xAxis?: {
    field: string;        // Поле для оси X
    label?: string;
  };
  yAxis?: {
    label?: string;
    min?: number;
    max?: number;
  };
  
  // Стиль
  showLegend: boolean;
  showGrid: boolean;
  colors?: string[];
  showDataLabels?: boolean;
}

/**
 * Настройки таблицы
 */
export interface TableConfig {
  columns: {
    field: string;
    label: string;
    width?: number;
    sortable: boolean;
    format?: DisplayFormat;
  }[];
  
  showPagination: boolean;
  pageSize: number;
  showSearch: boolean;
}

/**
 * Настройки метрик-карточки
 */
export interface MetricCardConfig {
  groupId: string;
  metricId: string;
  showTrend: boolean;           // Показывать тренд
  showComparison: boolean;      // Показывать сравнение
  comparisonPeriod?: 'previous' | 'year_ago';
}

/**
 * Конфигурация таблицы с группами показателей
 */
export interface IndicatorGroupsTableConfig {
  // Какие группы показывать (если null - все из дашборда)
  groupIds?: string[];
  
  // Какие виртуальные метрики показывать (колонки таблицы)
  virtualMetricIds: string[];
  
  // Настройки отображения
  showGroupNames: boolean;
  showRecordCount: boolean;      // Показывать количество записей
  highlightTopValues?: number;   // Подсветить N лучших значений
  
  // Сортировка
  sortBy?: {
    virtualMetricId?: string;    // Сортировка по виртуальной метрике
    groupId?: string;            // Или по обычной метрике
    metricId?: string;
    direction: 'asc' | 'desc';
  };
  
  // Стилизация
  alternateRowColors: boolean;
  compactMode: boolean;
}

/**
 * Базовый виджет дашборда
 */
export interface DashboardWidget {
  id: string;
  type: WidgetType;
  
  // Позиция и размер (для grid layout)
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  
  // Конфигурация в зависимости от типа
  config: 
    | ChartConfig 
    | TableConfig 
    | MetricCardConfig 
    | IndicatorGroupsTableConfig
    | { content: string };  // Для text виджетов
  
  // UI
  title: string;
  description?: string;
  
  // Настройки
  refreshInterval?: number;  // Автообновление в секундах
}

/**
 * Привязка виртуальной метрики внутри конфигурации дашборда
 */
export interface VirtualMetricBindingInDashboard {
  virtualMetricId: string; // ID колонки (например, "Обеспеченность")
  metricId: string;        // ID конкретной метрики группы
}

/**
 * Конфигурация группы показателей на конкретном дашборде
 */
export interface IndicatorGroupInDashboard {
  groupId: string;
  enabled: boolean;
  order: number;
  // Связь виртуальных колонок с реальными метриками хранится здесь
  virtualMetricBindings: VirtualMetricBindingInDashboard[];
}

/**
 * Дашборд
 */
export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  
  // Виртуальные метрики (общие показатели для всех групп)
  virtualMetrics: VirtualMetric[];
  
  // Активный иерархический фильтр
  // Определяет уровень детализации данных для ВСЕХ групп
  hierarchyFilters: HierarchyFilterValue[];
  
  // Какие группы показателей отображаются на дашборде и как они настроены
  indicatorGroups: IndicatorGroupInDashboard[];
  
  // Виджеты
  widgets: DashboardWidget[];
  kpiWidgets: KPIWidget[];

  // Настройки
  isPublic: boolean;
  refreshInterval?: number;  // Автообновление всего дашборда
  
  // Метаданные
  createdAt: number;
  updatedAt: number;
}