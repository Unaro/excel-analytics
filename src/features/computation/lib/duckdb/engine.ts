import { DashboardComputationResult } from '@/entities/metric';
import type { ClientComputeParams, IComputeEngine } from '../types';
import { duckdbManager } from './manager';
import { buildDuckDBTableName } from './table-name';


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