// shared/lib/computation/lib/duckdb/manager.ts
import type { DatasetRow, ColumnConfig } from '@/shared/lib/types/dataset';
import type { ClientComputeParams } from '../types';
import type { DashboardComputationResult } from '@/shared/lib/types/computation';

export interface ImportExcelResult {
  configs: ColumnConfig[];
  totalRows: number;
  totalColumns: number;
  sheetNames: string[];
}

export interface PingResult {
  alive: boolean;
  dbInitialized: boolean;
  tableExists: boolean;
  uptime: number;
}

export interface CheckTableResult {
  exists: boolean;
}

interface WorkerEventMap {
  REGISTER_ARROW: {
    payload: { datasetId: string; buffer: Uint8Array };
    response: void;
  };
  COMPUTE: {
    payload: { params: ClientComputeParams };
    response: DashboardComputationResult;
  };
  IMPORT_EXCEL: {
    payload: { datasetId: string; fileName: string; buffer: ArrayBuffer };
    response: ImportExcelResult;
  };
  GET_PREVIEW: {
    payload: { datasetId: string; limit: number };
    response: DatasetRow[];
  };
  EXPORT_ARROW: {
    payload: { datasetId: string };
    response: Uint8Array;
  };
  DROP_TABLE: {
    payload: { datasetId: string };
    response: void;
  };
  PING: {
    payload: { datasetId?: string };
    response: PingResult;
  };
  CHECK_TABLE: {
    payload: { datasetId: string };
    response: CheckTableResult;
  };
  RELOAD_ARROW: {
    payload: { datasetId: string; buffer: Uint8Array };
    response: void;
  };
}

interface WorkerResponseMessage {
  id: number;
  success: boolean;
  result?: unknown;
  error?: string;
}

export type DuckDBEngineStatus =
  | 'ready'
  | 'loading'
  | 'disconnected'
  | 'error'
  | 'no-data';

export class DuckDBWorkerManager {
  private worker: Worker | null = null;
  private messageCounter = 0;
  private callbacks = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (reason: Error) => void;
    }
  >();

  private _status: DuckDBEngineStatus = 'no-data';
  private _statusListeners = new Set<(status: DuckDBEngineStatus) => void>();

  subscribe(listener: (status: DuckDBEngineStatus) => void): () => void {
    this._statusListeners.add(listener);
    return () => {
      this._statusListeners.delete(listener);
    };
  }

  private setStatus(status: DuckDBEngineStatus) {
    if (this._status === status) return;
    this._status = status;
    this._statusListeners.forEach((l) => l(status));
  }

  get status(): DuckDBEngineStatus {
    return this._status;
  }

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

      this.worker.onerror = (event) => {
        console.error('[DuckDBManager] Worker error:', event);
        this.handleWorkerDisconnect('Worker onerror: ' + event.message);
      };

      this.worker.onmessage = (e: MessageEvent<WorkerResponseMessage>) => {
        const { id, success, result, error } = e.data;
        const cb = this.callbacks.get(id);
        if (cb) {
          success
            ? cb.resolve(result)
            : cb.reject(new Error(error || 'Unknown worker error'));
          this.callbacks.delete(id);
        }
      };

      if (this._status === 'disconnected') {
        this.setStatus('loading');
      }
    }
    return this.worker;
  }

  private handleWorkerDisconnect(reason: string) {
    console.warn(`[DuckDBManager] Worker disconnected: ${reason}`);
    for (const [id, cb] of this.callbacks.entries()) {
      cb.reject(new Error(`Worker disconnected: ${reason}`));
      this.callbacks.delete(id);
    }
    this.worker?.terminate();
    this.worker = null;
    this.setStatus('disconnected');
  }

  private dispatch<K extends keyof WorkerEventMap>(
    type: K,
    payload: WorkerEventMap[K]['payload'],
    transfer: Transferable[] = [],
    timeoutMs: number = 30000
  ): Promise<WorkerEventMap[K]['response']> {
    return new Promise((resolve, reject) => {
      const id = ++this.messageCounter;
      const timer = setTimeout(() => {
        this.callbacks.delete(id);
        this.handleWorkerDisconnect(`Timeout after ${timeoutMs}ms on ${type}`);
        reject(new Error(`Worker timeout: ${type}`));
      }, timeoutMs);

      this.callbacks.set(id, {
        resolve: (value: unknown) => {
          clearTimeout(timer);
          resolve(value as WorkerEventMap[K]['response']);
        },
        reject: (reason: Error) => {
          clearTimeout(timer);
          reject(reason);
        },
      });

      try {
        this.getWorker().postMessage({ type, payload, id }, transfer);
      } catch (err) {
        clearTimeout(timer);
        this.callbacks.delete(id);
        this.handleWorkerDisconnect(
          err instanceof Error ? err.message : 'postMessage failed'
        );
        reject(err);
      }
    });
  }

  async ping(datasetId?: string): Promise<PingResult | null> {
    try {
      return await this.dispatch('PING', { datasetId }, [], 3000);
    } catch {
      return null;
    }
  }

  async checkTable(datasetId: string): Promise<boolean> {
    try {
      const result = await this.dispatch('CHECK_TABLE', { datasetId }, [], 3000);
      return result.exists;
    } catch {
      return false;
    }
  }

  async reloadArrowBuffer(datasetId: string, arrowBuffer: Uint8Array): Promise<void> {
    return this.dispatch(
      'RELOAD_ARROW',
      { datasetId, buffer: arrowBuffer },
      [arrowBuffer.buffer]
    );
  }

  async ensureReady(datasetId: string, arrowBuffer: Uint8Array): Promise<boolean> {
    const pingResult = await this.ping(datasetId);
    if (
      pingResult?.alive &&
      pingResult.dbInitialized &&
      pingResult.tableExists
    ) {
      this.setStatus('ready');
      return true;
    }

    if (pingResult?.alive && pingResult.dbInitialized && !pingResult.tableExists) {
      console.log(
        `[DuckDBManager] ⚠️ Worker alive but table missing for ${datasetId}. Reloading...`
      );
      this.setStatus('loading');
      try {
        await this.reloadArrowBuffer(datasetId, arrowBuffer);
        this.setStatus('ready');
        return true;
      } catch (err) {
        console.error('[DuckDBManager] Table reload failed:', err);
        this.setStatus('error');
        return false;
      }
    }

    console.log(
      `[DuckDBManager] ♻️ Full auto-recovery for dataset ${datasetId} ` +
        `(alive=${pingResult?.alive}, dbInit=${pingResult?.dbInitialized})`
    );
    this.setStatus('loading');

    try {
      this.worker?.terminate();
      this.worker = null;
      await this.reloadArrowBuffer(datasetId, arrowBuffer);
      this.setStatus('ready');
      return true;
    } catch (err) {
      console.error('[DuckDBManager] Recovery failed:', err);
      this.setStatus('error');
      return false;
    }
  }

  markNoData() {
    this.setStatus('no-data');
  }

  async computeDashboard(
    params: ClientComputeParams,
    arrowBuffer?: Uint8Array
  ): Promise<DashboardComputationResult> {
    try {
      return await this.dispatch('COMPUTE', { params });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isTableMissing =
        message.includes('Catalog Error') && message.includes('does not exist');

      if (isTableMissing && arrowBuffer) {
        try {
          const ready = await this.ensureReady(params.datasetId, arrowBuffer);
          if (!ready) {
            throw err;
          }
          return await this.dispatch('COMPUTE', { params });
        } catch (retryErr) {
          console.error(
            '[DuckDBManager] COMPUTE retry failed after recovery:',
            retryErr
          );
          throw retryErr;
        }
      }

      throw err;
    }
  }

  async registerArrowBuffer(
    datasetId: string,
    arrowBuffer: Uint8Array
  ): Promise<void> {
    const result = await this.dispatch(
      'REGISTER_ARROW',
      { datasetId, buffer: arrowBuffer },
      [arrowBuffer.buffer]
    );
    this.setStatus('ready');
    return result;
  }

  async getPreviewRows(datasetId: string, limit: number = 500): Promise<DatasetRow[]> {
    return this.dispatch('GET_PREVIEW', { datasetId, limit });
  }

  async exportArrowBuffer(datasetId: string): Promise<Uint8Array> {
    return this.dispatch('EXPORT_ARROW', { datasetId });
  }

  async importExcelBuffer(
    datasetId: string,
    fileName: string,
    buffer: ArrayBuffer
  ): Promise<ImportExcelResult> {
    const result = await this.dispatch(
      'IMPORT_EXCEL',
      { datasetId, fileName, buffer },
      [buffer]
    );
    this.setStatus('ready');
    return result;
  }

  async dropTable(datasetId: string): Promise<void> {
    return this.dispatch('DROP_TABLE', { datasetId });
  }
}

export const duckdbManager = new DuckDBWorkerManager();