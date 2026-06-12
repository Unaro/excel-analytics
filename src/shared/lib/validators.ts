/**
 * Zod схемы для валидации данных в Server Actions
 */
import { z } from 'zod';

// Базовые типы
/** Строка импортированных данных: имя колонки → произвольное значение. */
export const ExcelRowSchema = z.record(z.string(), z.unknown());

/** Выбранное значение уровня иерархии (фильтр дашборда). */
export const HierarchyFilterValueSchema = z.object({
  levelId: z.string().min(1),
  levelIndex: z.number().int().min(0),
  columnName: z.string().min(1),
  value: z.string(),
  displayValue: z.string().optional(),
  operator: z.enum(['exact', '>', '<', '>=', '<=', 'between']).optional(),
  value2: z.string().optional(),
});

/** Виртуальная метрика дашборда (колонка таблицы показателей). */
export const VirtualMetricSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  unit: z.string().max(10).optional(),
  displayFormat: z.enum(['number', 'decimal', 'percent', 'currency', 'scientific']),
  decimalPlaces: z.number().int().min(0).max(10),
  order: z.number().int(),
  sourceMetricId: z.string().optional(),
  colorConfig: z.object({
    rules: z.array(z.object({
      id: z.string().min(1),
      operator: z.enum(['>', '>=', '<', '<=', '==', '!=', 'between']),
      value: z.number(),
      value2: z.number().optional(),
      color: z.enum(['emerald', 'rose', 'amber', 'blue', 'indigo', 'slate']),
    })),
  }).optional(),
});

/** Привязка алиаса формулы к колонке датасета. */
export const FieldBindingSchema = z.object({
  id: z.string().min(1),
  fieldAlias: z.string().min(1),
  columnName: z.string().min(1),
  description: z.string().optional(),
});

/** Привязка алиаса формулы к другой метрике группы. */
export const MetricBindingSchema = z.object({
  id: z.string().min(1),
  metricAlias: z.string().min(1),
  metricId: z.string().min(1),
  description: z.string().optional(),
});

/** Метрика внутри группы показателей (инстанс шаблона с привязками). */
export const GroupMetricSchema = z.object({
  id: z.string().min(1),
  templateId: z.string().min(1),
  fieldBindings: z.array(FieldBindingSchema),
  metricBindings: z.array(MetricBindingSchema),
  enabled: z.boolean(),
  order: z.number().int(),
  customName: z.string().optional(),
  customDisplayFormat: z.enum(['number', 'decimal', 'percent', 'currency', 'scientific']).optional(),
  customDecimalPlaces: z.number().int().optional(),
  unit: z.string().optional(),
});

/** Шаблон метрики: aggregate (функция+поле) или calculated (формула). */
export const MetricTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  type: z.enum(['aggregate', 'calculated']),
  aggregateFunction: z.enum(['SUM', 'AVG', 'MIN', 'MAX', 'COUNT', 'COUNT_DISTINCT', 'MEDIAN', 'PERCENTILE']).optional(),
  aggregateField: z.string().optional(),
  formula: z.string().optional(),
  dependencies: z.array(z.object({
    type: z.enum(['field', 'metric']),
    alias: z.string().min(1),
    description: z.string().optional(),
  })),
  displayFormat: z.enum(['number', 'decimal', 'percent', 'currency', 'scientific']),
  decimalPlaces: z.number().int().min(0).max(10),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

/** Группа показателей: набор метрик над полями датасета. */
export const IndicatorGroupSchema = z.object({
  id: z.string().min(1),
  datasetId: z.string().optional(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  fieldMappings: z.array(FieldBindingSchema),
  metrics: z.array(GroupMetricSchema),
  dependencyGraph: z.object({
    nodes: z.array(z.string()),
    edges: z.array(z.object({
      from: z.string(),
      to: z.string(),
    })),
  }).optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  order: z.number().int(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

// 1. Выносим привязку в отдельную схему
/** Связь виртуальной метрики дашборда с метрикой группы. */
export const VirtualMetricBindingInDashboardSchema = z.object({
  virtualMetricId: z.string().min(1),
  metricId: z.string().min(1),
});

// 2. Используем её внутри конфигурации группы
/** Конфигурация группы показателей на конкретном дашборде. */
export const IndicatorGroupInDashboardSchema = z.object({
  groupId: z.string().min(1),
  enabled: z.boolean(),
  order: z.number().int(),
  virtualMetricBindings: z.array(VirtualMetricBindingInDashboardSchema).optional(),
});

// 3. Экспортируем типы
export type VirtualMetricBindingInDashboard = z.infer<typeof VirtualMetricBindingInDashboardSchema>;
export type IndicatorGroupInDashboard = z.infer<typeof IndicatorGroupInDashboardSchema>;

// Схема для параметров вычисления
/** Параметры серверного вычисления метрик (legacy-путь по сырым строкам). */
export const ComputeParamsSchema = z.object({
  dashboardId: z.string().min(1).max(64),
  
  data: z.array(ExcelRowSchema)
    .min(0)
    .max(100000),
  
  allGroups: z.array(IndicatorGroupSchema)
    .max(100),
  
  dashboardGroupsConfig: z.array(IndicatorGroupInDashboardSchema)
    .max(100),
  
  metricTemplates: z.array(MetricTemplateSchema)
    .max(500),
  
  virtualMetrics: z.array(VirtualMetricSchema)
    .max(50),
  
  filters: z.array(HierarchyFilterValueSchema)
    .max(10),
});

export type ComputeParams = z.infer<typeof ComputeParamsSchema>;
export type ExcelRow = z.infer<typeof ExcelRowSchema>;
export type HierarchyFilterValue = z.infer<typeof HierarchyFilterValueSchema>;
export type VirtualMetric = z.infer<typeof VirtualMetricSchema>;
export type IndicatorGroup = z.infer<typeof IndicatorGroupSchema>;
export type MetricTemplate = z.infer<typeof MetricTemplateSchema>;
export type GroupMetric = z.infer<typeof GroupMetricSchema>;

export type FieldBinding = z.infer<typeof FieldBindingSchema>;
export type MetricBinding = z.infer<typeof MetricBindingSchema>;


/**
 * Строгая Zod-схема для валидации JSON-файла конфигурации датасета.
 *
 * Используется в features/config-persistence вместо `as unknown as`.
 * Даёт чёткие ошибки валидации при импорте повреждённых конфигов.
 */
export const DatasetConfigExportSchema = z.object({
  version: z.union([z.literal(1), z.literal(2)]),
  exportType: z.literal('dataset_config'),
  exportedAt: z.number(),
  sourceDatasetId: z.string(),
  data: z.object({
    dashboards: z.array(z.unknown()), // Dashboard — сложная схема, оставим unknown
    indicatorGroups: z.array(IndicatorGroupSchema),
    hierarchyLevels: z.array(z.object({
      id: z.string(),
      columnName: z.string(),
      displayName: z.string(),
      order: z.number(),
    })),
    columnConfigs: z.array(z.object({
      columnName: z.string(),
      classification: z.enum(['numeric', 'categorical', 'ignore', 'date']),
      alias: z.string(),
      displayName: z.string(),
      description: z.string().optional(),
      // Пользовательский тип со справочником: переносится как ссылка,
      // сам справочник в экспорт-пакет не входит
      customTypeId: z.string().optional(),
    })),
    metricTemplates: z.array(MetricTemplateSchema),
    groupMetricConfigs: z.record(
      z.string(),
      z.record(z.string(), z.object({
        colorConfig: z.object({
          rules: z.array(z.object({
            id: z.string(),
            operator: z.enum(['>', '>=', '<', '<=', '==', '!=', 'between']),
            value: z.number(),
            value2: z.number().optional(),
            color: z.enum(['emerald', 'rose', 'amber', 'blue', 'indigo', 'slate']),
          })),
        }).optional(),
      }))
    ).optional(),
  }),
});

export type DatasetConfigExportParsed = z.infer<typeof DatasetConfigExportSchema>;