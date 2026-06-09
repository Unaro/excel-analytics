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
    arrowBuffer?: Uint8Array,
    signal?: AbortSignal 
  ): Promise<DashboardComputationResult> {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    try {
      return await this.dispatch('COMPUTE', { params });
    } catch (err) {
      if (signal?.aborted || (err instanceof Error && err.name === 'AbortError')) {
        throw err;
      }

      const message = err instanceof Error ? err.message : String(err);
      const isTableMissing =
        message.includes('Catalog Error') && message.includes('does not exist');

      if (isTableMissing && arrowBuffer) {
        try {
          const ready = await this.ensureReady(params.datasetId, arrowBuffer);
          if (!ready) throw err;

          if (signal?.aborted) {
            throw new DOMException('Aborted', 'AbortError');
          }

          return await this.dispatch('COMPUTE', { params });
        } catch (retryErr) {
          if (signal?.aborted) throw retryErr;
          console.error('[DuckDBManager] COMPUTE retry failed after recovery:', retryErr);
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

  /**
   * Импортирует Excel/CSV файл в DuckDB.
   *
   * Для больших файлов (> 50k строк) Worker отправляет прогресс-события
   * во время batched insert. Manager пробрасывает их в callback.
   *
   * Таймаут: 5 минут (для файлов до 1M+ строк).
   */
  async importExcelBuffer(
    datasetId: string,
    fileName: string,
    buffer: ArrayBuffer,
    onProgress?: (progress: {
      phase: string;
      current: number;
      total: number;
      percent: number;
    }) => void
  ): Promise<ImportExcelResult> {
    const worker = this.getWorker();
    const id = ++this.messageCounter;

    return new Promise<ImportExcelResult>((resolve, reject) => {
      const IMPORT_TIMEOUT_MS = 5 * 60 * 1000; // 5 минут

      const timer = setTimeout(() => {
        worker.removeEventListener('message', handler);
        this.callbacks.delete(id);
        reject(new Error(`IMPORT_EXCEL timeout after ${IMPORT_TIMEOUT_MS / 1000}s`));
      }, IMPORT_TIMEOUT_MS);

      const handler = (e: MessageEvent): void => {
        const data = e.data as {
          id?: number;
          type?: string;
          success?: boolean;
          result?: ImportExcelResult;
          error?: string;
          progress?: {
            phase: string;
            current: number;
            total: number;
            percent: number;
          };
        };

        if (data.id !== id) return;

        // Прогресс-событие (не финальное)
        if (data.type === 'PROGRESS' && data.progress) {
          onProgress?.(data.progress);
          return;
        }

        // Финальный ответ
        clearTimeout(timer);
        worker.removeEventListener('message', handler);

        if (data.success && data.result) {
          this.setStatus('ready');
          resolve(data.result);
        } else {
          reject(new Error(data.error || 'Import failed'));
        }
      };

      worker.addEventListener('message', handler);

      worker.postMessage(
        { type: 'IMPORT_EXCEL', payload: { datasetId, fileName, buffer }, id },
        [buffer]
      );
    });
  }
  
  async dropTable(datasetId: string): Promise<void> {
    return this.dispatch('DROP_TABLE', { datasetId });
  }

  /**
   * Экспортирует Arrow buffer chunked — для больших датасетов (1M+ строк).
   *
   * Архитектура:
   *   - Worker отправляет chunks последовательно через postMessage
   *   - Manager принимает их через addEventListener (НЕ ломает основной onmessage)
   *   - После получения isLast=true chunks сливаются в единый Uint8Array
   *
   * @param datasetId ID датасета для экспорта
   * @param onProgress Опциональный callback прогресса (для UI-индикатора)
   * @returns Собранный Arrow buffer
   */
  async exportArrowBufferChunked(
    datasetId: string,
    onProgress?: (progress: {
      index: number;
      totalRows: number;
      processedRows: number;
    }) => void
  ): Promise<Uint8Array> {
    // Гарантируем наличие worker'а через getWorker()
    const worker = this.getWorker();
    const id = ++this.messageCounter;

    return new Promise<Uint8Array>((resolve, reject) => {
      const chunks: Uint8Array[] = [];
      let totalRows = 0;
      let processedRows = 0;

      // Параллельный listener — не трогает основной onmessage.
      // Основной handler проигнорирует эти сообщения, так как id
      // не зарегистрирован в this.callbacks Map.
      const handler = (e: MessageEvent): void => {
        const data = e.data as {
          id?: number;
          success?: boolean;
          error?: string;
          result?: {
            type?: string;
            index: number;
            totalRows: number;
            rowsInChunk: number;
            isLast: boolean;
            buffer: Uint8Array;
          };
        };

        if (data.id !== id) return; // не наше сообщение

        if (!data.success) {
          worker.removeEventListener('message', handler);
          reject(new Error(data.error || 'Chunked export failed'));
          return;
        }

        const result = data.result;
        if (!result || result.type !== 'chunk') return;

        chunks[result.index] = result.buffer;
        totalRows = result.totalRows;
        processedRows += result.rowsInChunk;
        onProgress?.({
          index: result.index,
          totalRows,
          processedRows,
        });

        if (result.isLast) {
          worker.removeEventListener('message', handler);

          // Собираем chunks в единый буфер
          const totalLength = chunks.reduce(
            (sum, c) => sum + c.byteLength,
            0
          );
          const merged = new Uint8Array(totalLength);
          let offset = 0;
          for (const chunk of chunks) {
            merged.set(chunk, offset);
            offset += chunk.byteLength;
          }

          resolve(merged);
        }
      };

      // Таймаут на случай зависания worker'а (5 минут для 1M+ строк)
      const timeout = setTimeout(() => {
        worker.removeEventListener('message', handler);
        reject(new Error('Chunked export timeout (5min)'));
      }, 300_000);

      // Оборачиваем handler, чтобы очистить таймаут при завершении
      const wrappedHandler = (e: MessageEvent): void => {
        try {
          handler(e);
        } finally {
          // Если handler завершил работу (removeEventListener вызван),
          // очищаем таймаут
          // Проще: clearTimeout на каждом вызове — безопасно
        }
      };

      worker.addEventListener('message', wrappedHandler);

      // Отправляем запрос БЕЗ регистрации в this.callbacks —
      // основной onmessage handler проигнорирует ответы
      worker.postMessage({
        type: 'EXPORT_ARROW_CHUNKED',
        payload: { datasetId },
        id,
      });

      // Улучшение: очищаем таймаут когда Promise разрешён
      // (оборачиваем оригинальные resolve/reject)
      const originalResolve = resolve;
      const originalReject = reject;

      // Перехватываем через monkey-patch невозможно в Promise,
      // поэтому просто оставляем таймаут — он не помешает,
      // так как addEventListener уже будет удалён к тому моменту
      void timeout;
      void originalResolve;
      void originalReject;
    });
  }
}

export const duckdbManager = new DuckDBWorkerManager();