import { ColumnConfig, DatasetRow } from "@/entities/dataset";
import { ClientComputeParams } from "../types";
import { DashboardComputationResult } from "@/entities/metric";

// 1. Описываем результаты (Response), которые возвращает воркер
export interface ImportExcelResult {
  configs: ColumnConfig[];
  totalRows: number;
  totalColumns: number;
  sheetNames: string[];
}

// 2. Создаем карту событий Воркера (Event Map)
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
}

// Тип для входящего сообщения от воркера к менеджеру
interface WorkerResponseMessage {
  id: number;
  success: boolean;
  result?: unknown;
  error?: string;
}

export class DuckDBWorkerManager {
  private worker: Worker | null = null;
  private messageCounter = 0;
  

  private callbacks = new Map<number, { 
    resolve: (value: unknown) => void; 
    reject: (reason: Error) => void 
  }>();

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      
      this.worker.onmessage = (e: MessageEvent<WorkerResponseMessage>) => {
        const { id, success, result, error } = e.data;
        const cb = this.callbacks.get(id);
        
        if (cb) {
          success ? cb.resolve(result) : cb.reject(new Error(error || 'Unknown worker error'));
          this.callbacks.delete(id);
        }
      };
    }
    return this.worker;
  }

  private dispatch<K extends keyof WorkerEventMap>(
    type: K,
    payload: WorkerEventMap[K]['payload'],
    transfer: Transferable[] = []
  ): Promise<WorkerEventMap[K]['response']> {
    return new Promise((resolve, reject) => {
      const id = ++this.messageCounter;
      
      this.callbacks.set(id, { 
        resolve: (value: unknown) => resolve(value as WorkerEventMap[K]['response']), 
        reject 
      });
      
      this.getWorker().postMessage({ type, payload, id }, transfer);
    });
  }

  async registerArrowBuffer(datasetId: string, arrowBuffer: Uint8Array): Promise<void> {
    return this.dispatch('REGISTER_ARROW', { datasetId, buffer: arrowBuffer }, [arrowBuffer.buffer]);
  }

  async computeDashboard(params: ClientComputeParams): Promise<DashboardComputationResult> {
    return this.dispatch('COMPUTE', { params });
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
    return this.dispatch('IMPORT_EXCEL', { datasetId, fileName, buffer }, [buffer]);
  }

  /**
 * Удаляет таблицу датасета из DuckDB.
 * Используется при замене файла или удалении датасета.
 */
  async dropTable(datasetId: string): Promise<void> {
    return this.dispatch('DROP_TABLE', { datasetId });
  }
}

export const duckdbManager = new DuckDBWorkerManager();