// entities/dataset/index.ts
export type * from './model/types';
export { useDatasetStore } from './model/store';

// Маппинг типов PG-схемы в конфиги колонок (нужен sync-движку фичи setup-dataset)
export { generateColumnConfigsFromPgSchema } from './lib/type-mapper';

// Статус вычислительного движка датасета (DuckDB-WASM)
export { useEngineStatus } from './lib/use-engine-status';
export type { EngineStatusState } from './lib/use-engine-status';
