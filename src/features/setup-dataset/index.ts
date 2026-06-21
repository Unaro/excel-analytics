// features/setup-dataset — public API
// Сценарии импорта/синхронизации источников данных (файл, PostgreSQL).
export { useDatasetManager } from './model/use-dataset-manager';
export { useDatasetReplace } from './model/use-dataset-replace';
export { useDashboardFilterReconciler } from './model/use-dashboard-filter-reconciler';
export { useFileImport } from './model/use-file-import';
export {
  replaceDatasetFile,
  syncFromFile,
  syncFromPostgres,
  refreshPgDataset,
} from './model/sync-engine';
export { removeDatasetCompletely } from './model/remove-dataset';
export {
  buildFilePreview,
  buildCsvPreviewFromText,
  isCsvFileName,
  detectLineEnding,
  guessColumnTypes,
  guessColumnType,
  detectDateFormat,
  CSV_PREFIX_BYTES,
} from './lib/file-preview';
export type {
  FilePreview,
  FilePreviewOptions,
  ImportParams,
  DecimalSeparator,
} from './lib/file-preview';
export {
  isEmptyCell,
  isMetricColumn,
  detectKeyColumns,
  detectHeaderRows,
  buildColumns,
  classifyRow,
  classifyRows,
  buildHierarchyPreview,
  proposeGroups,
} from './lib/aggregate-layout';
export { readAggregateMatrix } from './lib/file-preview';
export type { AggregateMatrix } from './lib/file-preview';
export type {
  ColumnRole,
  RowKind,
  AggregateColumn,
  ClassifiedRow,
  EmptyConfig,
  HierarchyPreviewNode,
  ProposedGroup,
} from './lib/aggregate-layout';
