import type { DashboardComputationResult } from '@/shared/lib/types/computation';
import type { ClientComputeParams, IComputeEngine } from '../types';
import { duckdbManager } from './manager';
import { buildTableName } from './table-name';
import { get } from 'idb-keyval';

export class DuckDbEngine implements IComputeEngine {
  async initialize(): Promise<void> {}

  async compute(
    params: ClientComputeParams,
    signal?: AbortSignal 
  ): Promise<DashboardComputationResult> {
    const start = Date.now();
    const duckParams = {
      ...params,
      tableName: buildTableName(params.datasetId),
    };

    let arrowBuffer: Uint8Array | undefined;
    try {
      const buf = await get(`arrow:${params.datasetId}`);
      if (buf instanceof Uint8Array && buf.byteLength > 0) {
        arrowBuffer = buf;
      }
    } catch (err) {
      console.warn('[DuckDbEngine] Failed to load Arrow buffer for retry:', err);
    }

    const result = await duckdbManager.computeDashboard(duckParams, arrowBuffer, signal);
    return {
      ...result,
      computationTime: Date.now() - start,
    };
  }

  dispose(): void {}
}