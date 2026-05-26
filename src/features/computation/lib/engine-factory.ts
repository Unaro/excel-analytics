import { DuckDbEngine } from './duckdb/engine';
import { PgEngine } from './postgres/engine';
import type { IComputeEngine } from './types';

export function createComputeEngine(sourceType: 'file' | 'postgres'): IComputeEngine {
  return sourceType === 'file' ? new DuckDbEngine() : new PgEngine();
}