import { DashboardComputationResult } from '@/entities/metric';
import type { ClientComputeParams, IComputeEngine } from '../types';
import { duckdbManager } from './manager';

/**
 * Генерирует имя таблицы DuckDB из datasetId.
 * ДОЛЖНО совпадать с логикой в worker.ts (REGISTER_ARROW, IMPORT_EXCEL)
 */
function buildDuckDBTableName(datasetId: string): string {
  return `dt_${datasetId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

export class DuckDbEngine implements IComputeEngine {
  async initialize(): Promise<void> {}

  async compute(params: ClientComputeParams): Promise<DashboardComputationResult> {
    const start = Date.now();
    const duckParams = {
      ...params,
      tableName: buildDuckDBTableName(params.datasetId),
    };
    const result = await duckdbManager.computeDashboard(duckParams);
    return {
      ...result,
      computationTime: Date.now() - start,
    };
  }

  dispose(): void {}
}