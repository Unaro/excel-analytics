'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDatasetStore } from '@/entities/dataset';
import { duckdbManager, type DuckDBEngineStatus } from '@/shared/lib/computation/lib/duckdb/manager';
import { get } from 'idb-keyval';

export interface EngineStatusState {
  /** Текущий статус движка */
  status: DuckDBEngineStatus;
  /** ID активного file-датасета (или null) */
  activeFileDatasetId: string | null;
  /** Попытка восстановить движок (reload из IDB) */
  reload: () => Promise<boolean>;
  /** true во время reload */
  isReloading: boolean;
}

/**
 * Отслеживает состояние DuckDB Worker'а в реальном времени.
 * 
 * Для file-датасетов:
 *   - 'ready' — Worker жив, SQL-запросы работают
 *   - 'disconnected' — Worker упал, нужна перезагрузка
 *   - 'loading' — идёт восстановление
 *   - 'error' — не удалось восстановить (нет Arrow buffer в IDB)
 *   - 'no-data' — нет активных file-датасетов
 * 
 * Для postgres-датасетов всегда возвращает 'ready'
 * (PG-запросы идут через Server Actions, Worker не нужен).
 */
export function useEngineStatus(): EngineStatusState {
  const activeDatasetId = useDatasetStore(s => s.activeDatasetId);
  const activeDataset = useDatasetStore(s => 
    activeDatasetId ? s.datasets[activeDatasetId] : null
  );
  const sourceType = activeDataset?.sourceType ?? 'file';
  
  const [status, setStatus] = useState<DuckDBEngineStatus>(duckdbManager.status);
  const [isReloading, setIsReloading] = useState(false);
  
  // Подписка на изменения статуса
  useEffect(() => {
    if (sourceType !== 'file') {
      // PG-source не зависит от Worker'а
      setStatus('ready');
      return;
    }
    
    const unsubscribe = duckdbManager.subscribe(setStatus);
    
    // При монтировании — делаем ping для актуального статуса
    duckdbManager.ping().then(result => {
      if (!result) {
        setStatus('disconnected');
      } else if (!result.dbInitialized) {
        setStatus('loading');
      } else {
        setStatus('ready');
      }
    });
    
    return unsubscribe;
  }, [sourceType]);
  
  const reload = useCallback(async (): Promise<boolean> => {
    if (sourceType !== 'file' || !activeDatasetId) {
      return true;
    }
    
    setIsReloading(true);
    try {
      // 1. Достаём Arrow buffer из IndexedDB
      const arrowBuffer = await get(`arrow:${activeDatasetId}`);
      
      if (!(arrowBuffer instanceof Uint8Array) || arrowBuffer.byteLength === 0) {
        console.error('[useEngineStatus] No Arrow buffer in IDB for', activeDatasetId);
        setStatus('error');
        return false;
      }
      
      // 2. Делегируем восстановление менеджеру
      const success = await duckdbManager.ensureReady(activeDatasetId, arrowBuffer);
      return success;
    } catch (err) {
      console.error('[useEngineStatus] Reload failed:', err);
      setStatus('error');
      return false;
    } finally {
      setIsReloading(false);
    }
  }, [sourceType, activeDatasetId]);
  
  return {
    status: sourceType === 'file' ? status : 'ready',
    activeFileDatasetId: sourceType === 'file' ? activeDatasetId : null,
    reload,
    isReloading,
  };
}