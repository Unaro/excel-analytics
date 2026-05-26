import { DashboardComputationResult } from "@/entities/metric";
import { HierarchyFilterValue, IndicatorGroup, IndicatorGroupInDashboard, MetricTemplate, VirtualMetric } from "@/shared/lib/validators";

export type ComputeDialect = 'duckdb' | 'postgres';
export type QueryParam = string | number | boolean | null;

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
}

export interface CompiledQuery {
  sql: string;
  params?: QueryParam[];
  formulas: Map<string, {
    groupId: string;
    metricId: string;
    templateId: string;
    formula: string;
    dependencies: { alias: string; baseExpr: string }[];
  }>;
}

export interface IComputeEngine {
  initialize(datasetId: string): Promise<void>;
  compute(params: ClientComputeParams): Promise<DashboardComputationResult>;
  dispose(datasetId: string): void;
}