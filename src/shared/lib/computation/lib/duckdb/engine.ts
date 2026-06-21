import { logger } from '@/shared/lib/logger';
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

    // Arrow-буфер (сотни МБ) нужен лишь для редкого восстановления таблицы,
    // поэтому грузим его ЛЕНИВО — только если COMPUTE упал с «table missing».
    // Раньше read из IndexedDB шёл на каждый запрос и блокировал поток.
    const loadArrowBuffer = async (): Promise<Uint8Array | undefined> => {
      try {
        const buf = await get(`arrow:${params.datasetId}`);
        if (buf instanceof Uint8Array && buf.byteLength > 0) return buf;
      } catch (err) {
        logger.warn('[DuckDbEngine] Failed to load Arrow buffer for retry:', err);
      }
      return undefined;
    };

    const result = await duckdbManager.computeDashboard(duckParams, loadArrowBuffer, signal);
    return {
      ...result,
      computationTime: Date.now() - start,
    };
  }

  dispose(): void {}
}