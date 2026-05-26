
import type { 
  VirtualMetric, 
  IndicatorGroupInDashboard 
} from '@/shared/lib/validators';

import type { HierarchyFilterValue } from '@/entities/hierarchy/model/types';
import type { DisplayFormat } from '@/entities/metric/model/types';

// Оставляем ТОЛЬКО UI-типы:
export type MetricColor = 'emerald' | 'rose' | 'amber' | 'blue' | 'indigo' | 'slate';
export type ConditionOperator = '>' | '>=' | '<' | '<=' | '==' | '!=' | 'between';

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

export interface KPIWidget {
  id: string;
  templateId: string;
  bindings: Record<string, string>;
  customName?: string;
  color?: MetricColor;
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
 * Дашборд
 */
export interface Dashboard {
  id: string;
  datasetId: string;
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