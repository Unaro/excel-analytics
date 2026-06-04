import { DashboardComputationResult } from "@/entities/metric";
import { HierarchyFilterValue, IndicatorGroup, IndicatorGroupInDashboard, MetricTemplate, VirtualMetric } from "@/shared/lib/validators";

export type ComputeDialect = 'duckdb' | 'postgres';
export type QueryParam = string | number | boolean | null;

export interface MetricAggregationMeta {
  aggregateFunction: 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'COUNT' | 'COUNT_DISTINCT' | 'MEDIAN' | 'PERCENTILE';
}

export interface ClientComputeParams {
  datasetId: string;
  dashboardId: string;
  encryptedConfig?: string;
  filters: HierarchyFilterValue[];
  groups: IndicatorGroup[];
  tableName: string;
  dashboardGroupsConfig: IndicatorGroupInDashboard[];
  metricTemplates: MetricTemplate[];
  virtualMetrics: VirtualMetric[];
  groupByColumn?: string;
  validColumns?: string[];
}

export interface CompiledQuery {
  sql: string;
  params?: QueryParam[];
  formulas: Map<string, {
    groupId: string;
    metricId: string;
    templateId: string;
    formula: string;
    fieldDependencies: {
      alias: string;
      columnName: string;
      aggregateFn: string;
    }[];
    metricDependencies: {
      alias: string;
      metricId: string;
    }[];
  }>;
  aggregateMetadata: Map<string, MetricAggregationMeta>;
}

export interface IComputeEngine {
  initialize(datasetId: string): Promise<void>;
  compute(params: ClientComputeParams): Promise<DashboardComputationResult>;
  dispose(datasetId: string): void;
}