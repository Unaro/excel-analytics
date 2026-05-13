// types/index.ts
/**
 * ЕДИНАЯ ТОЧКА ВХОДА ДЛЯ ВСЕХ ТИПОВ ПРИЛОЖЕНИЯ
 * Импорт только отсюда: import type { ... } from '@/types';
 */

// 1. Типы из Zod-валидаторов (Source of Truth)
export type {
  VirtualMetric,
  IndicatorGroupInDashboard,
  VirtualMetricBindingInDashboard,
  MetricTemplate,
  GroupMetric,
  FieldBinding,
  MetricBinding,
  IndicatorGroup,
  ComputeParams,
  ExcelRow, // Алиас на DatasetRow для обратной совместимости
  HierarchyFilterValue
} from '@/lib/logic/validators';

// 2. Типы дашбордов (UI/Store)
export type {
  Dashboard, KPIWidget, DashboardWidget, WidgetType, ChartType, ChartConfig,
  TableConfig, MetricCardConfig, IndicatorGroupsTableConfig, MetricColor,
  ConditionOperator, FormattingRule, ColorConfig
} from '@/entities/dashboard/model/types';

// 3. Типы метрик
export type {
  AggregateFunction, MetricType, DisplayFormat, MetricSourceType, MetricDependency
} from '@/entities/metric/model/types';

export type {
  ComputationContext, ComputedMetricValue, VirtualMetricValue,
  GroupComputationResult, ActiveHierarchyFilter, DashboardComputationResult,
  MetricCache
} from '@/entities/metric/model/computed-types';

// 4. Типы датасетов и колонок
export type {
  DatasetSourceType, DatasetRow, DatasetMetadata, PgSyncConfig,
  DatasetEntry, ColumnStatistics
} from '@/entities/dataset/model/types';

export type {
  ColumnClassification, ColumnConfig, ColumnDataType
} from '@/entities/dataset';

export type {
  SheetData
} from '@/entities/columnConfig'

// 5. Типы иерархии
export type {
  HierarchyLevel, HierarchyNode, HierarchyConfig,
  BuildHierarchyTreeRequest, HierarchyTreeResult, GetLevelValuesOptions
} from '@/entities/hierarchy/model/types';

// 6. Типы формул
export type {
  ValidationErrorType, ValidationError, ValidationResult
} from '@/entities/formula/model/validation-types';

export type {
  FormulaOperator, FormulaToken, ParsedFormula, AvailableField,
  AvailableMetric, FormulaSuggestion, FormulaBuilderState
} from '@/entities/formula/model/types';