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
  /** Категориальное измерение breakdown (обычно следующий уровень иерархии). */
  groupByColumn?: string;
  /**
   * Вторая ось breakdown (источник `_date_label` / BreakdownItem.dateLabel).
   * Обобщает временну́ю ось на любое измерение:
   *  - date   → метка интервала (date_trunc);
   *  - column → сырое значение колонки;
   *  - bucket → корзина-диапазон числовой колонки (width_bucket).
   * `topN` (column/bucket) сворачивает редкие значения в «Прочее».
   * Если задано — имеет приоритет над legacy groupByDateColumn.
   */
  secondary?: SecondaryDimension;
  /**
   * @deprecated legacy временна́я ось (дашборд). Если `secondary` не задан,
   * компилятор выводит из этих полей `{ kind: 'date' }`. groupByColumn —
   * первая ось (категория), при двумерной группировке `_date_label` — интервал.
   */
  groupByDateColumn?: string;
  /** @deprecated размерность date_trunc (см. groupByDateColumn). */
  groupByDateGranularity?: DateGranularity;
  validColumns?: string[];
  pgSchema?: string;
  pgTable?: string;
  /**
   * Настройки агрегатных формул: дефолтный авто-агрегат для голой колонки
   * и режим запрета голых колонок. Отсутствует → DEFAULT_AGGREGATE_OPTIONS.
   */
  formulaOptions?: AggregateFormulaOptions;
}

/** Настройки агрегатных формул (дефолтный авто-агрегат + строгий режим). */
export interface AggregateFormulaOptions {
  /** Чем оборачивать голую колонку вне агрегата (SUM/AVG/MIN/MAX/COUNT…). */
  defaultAggregate: string;
  /** true — голая колонка вне агрегата запрещена (ошибка вместо авто-обёртки). */
  requireExplicit: boolean;
}

/**
 * Вторая ось разбивки 2-D: дата (интервалы), категориальная колонка (значения)
 * или числовая колонка (корзины). topN сворачивает хвост в «Прочее».
 */
export type SecondaryDimension =
  | { kind: 'date'; columnName: string; granularity: DateGranularity }
  | { kind: 'column'; columnName: string; topN?: number }
  | { kind: 'bucket'; columnName: string; bucketCount: number; topN?: number };

/** Размерность временно́й группировки breakdown. */
export type DateGranularity =
  | 'minute'
  | 'hour'
  | 'day'
  | 'week'
  | 'month'
  | 'year';

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