/**
 * Zod-схемы входных данных Server Actions.
 *
 * Вынесены в отдельный модуль, потому что файлы с 'use server' могут
 * экспортировать только async-функции. Всё, что приходит в Server Action
 * с клиента, — недоверенный ввод и обязано проходить через эти схемы.
 */
import { z } from 'zod';
import {
  HierarchyFilterValueSchema,
  IndicatorGroupSchema,
  IndicatorGroupInDashboardSchema,
  MetricTemplateSchema,
  VirtualMetricSchema,
} from '@/shared/lib/validators';
import { AGGREGATE_FUNCTIONS } from '@/shared/lib/computation/lib/aggregate-functions';

/** Конфигурация подключения к PostgreSQL (валидация перед коннектом). */
export const PgConfigSchema = z.object({
  host: z.string().min(1, 'Хост обязателен'),
  port: z.coerce.number().int().min(1).max(65535),
  database: z.string().min(1, 'Имя БД обязательно'),
  user: z.string().min(1, 'Пользователь обязателен'),
  password: z.string(),
  ssl: z.boolean().optional().default(false),
  sslAllowInvalidCerts: z.boolean().optional().default(false),
});

/**
 * Параметры вычисления, приходящие с клиента в computePgMetrics.
 *
 * ВАЖНО: `tableName` и `validColumns` принимаются схемой, но сервер их
 * ИГНОРИРУЕТ — имя таблицы строится на сервере из проверенных
 * `pgSchema`/`pgTable`, а список колонок берётся из information_schema.
 * Клиентским значениям этих полей доверять нельзя (SQL-инъекция).
 */
export const ClientComputeParamsSchema = z.object({
  datasetId: z.string().min(1).max(128),
  dashboardId: z.string().min(1).max(128),
  encryptedConfig: z.string().optional(),
  filters: z.array(HierarchyFilterValueSchema).max(20),
  groups: z.array(IndicatorGroupSchema).max(100),
  tableName: z.string().optional(),
  dashboardGroupsConfig: z.array(IndicatorGroupInDashboardSchema).max(100),
  metricTemplates: z.array(MetricTemplateSchema).max(500),
  virtualMetrics: z.array(VirtualMetricSchema).max(50),
  groupByColumn: z.string().max(255).optional(),
  groupByDateColumn: z.string().max(255).optional(),
  // Временна́я группировка: enum, т.к. значение попадает в date_trunc('<g>',…)
  groupByDateGranularity: z
    .enum(['minute', 'hour', 'day', 'week', 'month', 'year'])
    .optional(),
  validColumns: z.array(z.string()).optional(),
  pgSchema: z.string().min(1).max(255),
  pgTable: z.string().min(1).max(255),
  // Дефолтный агрегат уходит в buildAggregateExpr (whitelist функций),
  // requireExplicit влияет только на компиляцию формулы.
  formulaOptions: z
    .object({
      defaultAggregate: z.enum(AGGREGATE_FUNCTIONS),
      requireExplicit: z.boolean(),
    })
    .optional(),
});
