import { DuckDbEngine } from './duckdb/engine';
import { PgEngine } from './postgres/engine';
import type { IComputeEngine } from './types';

/**
 * Фабрика вычислительного движка по типу источника данных:
 * file → DuckDB-WASM в браузере, postgres → Server Action.
 */
export function createComputeEngine(sourceType: 'file' | 'postgres'): IComputeEngine {
  return sourceType === 'file' ? new DuckDbEngine() : new PgEngine();
}