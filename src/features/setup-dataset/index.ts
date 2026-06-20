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
export { buildFilePreview, isCsvFileName, detectLineEnding } from './lib/file-preview';
export type { FilePreview, FilePreviewOptions } from './lib/file-preview';
