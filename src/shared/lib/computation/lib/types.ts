import type { DashboardComputationResult } from '@/shared/lib/types/computation';
import type {
  HierarchyFilterValue,
  IndicatorGroup,
  IndicatorGroupInDashboard,
  MetricTemplate,
  VirtualMetric,
} from '@/shared/lib/validators';

export type ComputeDialect = 'duckdb' | 'postgres';
export type QueryParam = string | number | boolean | null;

export interface MetricAggregationMeta {
  aggregateFunction:
    | 'SUM'
    | 'AVG'
    | 'MIN'
    | 'MAX'
    | 'COUNT'
    | 'COUNT_DISTINCT'
    | 'MEDIAN'
    | 'PERCENTILE';
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
  pgSchema?: string;
  pgTable?: string;
}

export interface CompiledFormulaMeta {
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
}

export interface CompiledQuery {
  sql: string;
  params?: QueryParam[];
  formulas: Map<string, CompiledFormulaMeta>;
  aggregateMetadata: Map<string, MetricAggregationMeta>;
  /**
   * Алиасы calculated-метрик, УЖЕ вычисленные внутри SQL через CTE.
   * postProcessAggregates должен их пропускать — значения уже в строках.
   *
   * Если Set пустой (все формулы упали в fallback), post-process
   * вычислит их через Math.js как раньше.
   */
  calculatedInSqlAliases: Set<string>;
}

export interface IComputeEngine {
  initialize(datasetId: string): Promise<void>;
  compute(
    params: ClientComputeParams,
    signal?: AbortSignal
  ): Promise<DashboardComputationResult>;
  dispose(datasetId: string): void;
}