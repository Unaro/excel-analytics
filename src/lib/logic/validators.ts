/**
 * Zod схемы для валидации данных в Server Actions
 */
import { z } from 'zod';

// Базовые типы
export const ExcelRowSchema = z.record(z.string(), z.unknown());

export const HierarchyFilterValueSchema = z.object({
  levelId: z.string().min(1),
  levelIndex: z.number().int().min(0),
  columnName: z.string().min(1),
  value: z.string(),
  displayValue: z.string().optional(),
});

export const VirtualMetricSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  unit: z.string().max(10).optional(),
  displayFormat: z.enum(['number', 'decimal', 'percent', 'currency', 'scientific']),
  decimalPlaces: z.number().int().min(0).max(10),
  order: z.number().int(),
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

export const FieldBindingSchema = z.object({
  id: z.string().min(1),
  fieldAlias: z.string().min(1),
  columnName: z.string().min(1),
  description: z.string().optional(),
});

export const MetricBindingSchema = z.object({
  id: z.string().min(1),
  metricAlias: z.string().min(1),
  metricId: z.string().min(1),
  description: z.string().optional(),
});

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

export const IndicatorGroupSchema = z.object({
  id: z.string().min(1),
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

export const IndicatorGroupInDashboardSchema = z.object({
  groupId: z.string().min(1),
  enabled: z.boolean(),
  order: z.number().int(),
  virtualMetricBindings: z.array(z.object({
    virtualMetricId: z.string().min(1),
    metricId: z.string().min(1),
  })).optional(),
});

// Схема для параметров вычисления
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
export type IndicatorGroupInDashboard = z.infer<typeof IndicatorGroupInDashboardSchema>;
export type MetricTemplate = z.infer<typeof MetricTemplateSchema>;
export type GroupMetric = z.infer<typeof GroupMetricSchema>;
