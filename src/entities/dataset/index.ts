// entities/dataset/index.ts
export type * from './model/types';
export { useDatasetStore } from './model/store';
export { useFileImport } from './model/use-file-import';

// Sync-engine: только entity-level функции.
// UI-оркестрация (toast, router) и кросс-entity связи (dashboard filters)
// вынесены в features/setup-dataset/
export {
  replaceDatasetFile,
  syncFromFile,
  syncFromPostgres,
  refreshPgDataset,
} from './model/sync-engine';
// Статус вычислительного движка датасета (DuckDB-WASM)
export { useEngineStatus } from './lib/use-engine-status';
export type { EngineStatusState } from './lib/use-engine-status';
