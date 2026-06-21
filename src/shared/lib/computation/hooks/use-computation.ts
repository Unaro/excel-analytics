'use client';

import { logger } from '@/shared/lib/logger';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createComputationCache,
  type IComputationCache,
  type CacheKey,
} from '@/shared/lib/storage';
import { createComputeEngine } from '@/shared/lib/computation/lib/engine-factory';
import type { ClientComputeParams, IComputeEngine } from '@/shared/lib/computation/lib/types';
import type { DashboardComputationResult } from '@/shared/lib/types/computation';

export interface UseComputationOptions {
  activeDatasetId: string | null;
  sourceType: 'file' | 'postgres';
  isSyncing: boolean;
  buildParams: () => ClientComputeParams | null;
  buildCacheKey: () => CacheKey | null;
  debounceMs?: number;
  autoExecute?: boolean;
  deps?: unknown[];
  /** Метка для профиля задержки (например 'dashboard' / 'hierarchy:НП'). */
  label?: string;
}

export interface UseComputationResult {
  result: DashboardComputationResult | null;
  isComputing: boolean;
  error: string | null;
  recalculate: () => Promise<void>;
  execute: () => Promise<void>;
}

/**
 * Проверяет, является ли ошибка следствием отмены через AbortController.
 * Такие ошибки НЕ должны попадать в state.error.
 */
function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') return true;
  if (err instanceof Error && err.name === 'AbortError') return true;
  return false;
}

/**
 * Единый хук для вычислений DuckDB / PostgreSQL.
 *
 * Гарантирует:
 *   - AbortController для реальной отмены устаревших запросов
 *   - Request versioning (защита от stale closures)
 *   - Debounce для защиты от spam-запросов
 *   - Автоматическое кэширование через IComputationCache
 *   - Корректную обработку ошибок с фильтрацией AbortError
 *
 * Контракт перезапуска: авто-исполнение триггерится ТОЛЬКО изменением
 * `deps` (контентные хеши) и смены датасета/синхронизации. `buildParams` /
 * `buildCacheKey` читаются через ref — их identity не влияет на эффект,
 * поэтому ререндеры вызывающего хука (например, правка условного
 * форматирования, живущего рядом с данными) не запускают пересчёт.
 */
export function useComputation({
  activeDatasetId,
  sourceType,
  isSyncing,
  buildParams,
  buildCacheKey,
  debounceMs = 100,
  autoExecute = true,
  deps = [],
  label = 'compute',
}: UseComputationOptions): UseComputationResult {
  const [result, setResult] = useState<DashboardComputationResult | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestVersionRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  // Момент, когда работа была запрошена (изменение deps) — для замера
  // сквозной задержки «клик → результат» (debounce + очередь + воркер).
  const pendingStartRef = useRef<number | null>(null);

  // ✅ NEW: Храним последние версии функций в refs
  const buildParamsRef = useRef(buildParams);
  const buildCacheKeyRef = useRef(buildCacheKey);

  // Обновляем refs при каждом рендере (без зависимостей)
  useEffect(() => {
    buildParamsRef.current = buildParams;
    buildCacheKeyRef.current = buildCacheKey;
  });

  const engine: IComputeEngine = useMemo(
    () => createComputeEngine(sourceType),
    [sourceType]
  );

  const cache: IComputationCache = useMemo(
    () => createComputationCache(sourceType),
    [sourceType]
  );

  const executeInternal = useCallback(
    async (force = false): Promise<void> => {
      if (!activeDatasetId || isSyncing) return;

      // ✅ Используем refs вместо прямых вызовов
      const params = buildParamsRef.current();
      const cacheKey = buildCacheKeyRef.current();
      
      if (!params || !cacheKey) return;

      const currentVersion = ++requestVersionRef.current;

      // Замер сквозной задержки: для force-пути (recalculate без debounce)
      // ставим отметку здесь, если её ещё не поставил execute().
      if (pendingStartRef.current === null) pendingStartRef.current = performance.now();
      const logLatency = (kind: 'cache' | 'worker') => {
        const start = pendingStartRef.current;
        pendingStartRef.current = null;
        if (start != null) {
          logger.info(
            `[useComputation] ⏱️ ${label} → ${kind} ${Math.round(performance.now() - start)}ms ` +
              `(debounce ${debounceMs}ms incl.)`
          );
        }
      };

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const { signal } = controller;

      setError(null);

      try {
        if (!force) {
          const cached = await cache.get(cacheKey);
          if (signal.aborted || currentVersion !== requestVersionRef.current) return;
          if (cached) {
            setResult(cached.result);
            setIsComputing(false);
            logLatency('cache');
            return;
          }
        }

        setIsComputing(true);
        await engine.initialize(activeDatasetId);
        if (signal.aborted || currentVersion !== requestVersionRef.current) return;

        const computedResult = await engine.compute(params, signal);
        if (signal.aborted || currentVersion !== requestVersionRef.current) return;

        setResult(computedResult);
        setIsComputing(false);
        logLatency('worker');

        cache.set(cacheKey, computedResult).catch(err => {
          logger.warn('[useComputation] Cache save failed:', err);
        });
      } catch (err) {
        if (isAbortError(err)) return;
        if (signal.aborted || currentVersion !== requestVersionRef.current) return;

        logger.error('[useComputation] Compute failed:', err);
        setError(err instanceof Error ? err.message : 'Ошибка вычисления');
        setIsComputing(false);
      }
    },
    // ✅ УБРАЛИ buildParams и buildCacheKey из зависимостей!
    [activeDatasetId, isSyncing, cache, engine, label, debounceMs]
  );

  const execute = useCallback(async (): Promise<void> => {
    // Отметка старта = момент запроса работы (до debounce), чтобы профиль
    // включал ожидание debounce — главный подозреваемый в «лаге после клика».
    if (pendingStartRef.current === null) pendingStartRef.current = performance.now();
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    return new Promise<void>(resolve => {
      debounceTimerRef.current = setTimeout(() => {
        executeInternal(false).finally(resolve);
      }, debounceMs);
    });
  }, [executeInternal, debounceMs]);

  const recalculate = useCallback(async (): Promise<void> => {
    if (!activeDatasetId) return;
    
    // ✅ Используем ref
    const cacheKey = buildCacheKeyRef.current();
    if (cacheKey) {
      try {
        await cache.invalidate(cacheKey);
      } catch (err) {
        logger.warn('[useComputation] Cache invalidate failed:', err);
      }
    }
    await executeInternal(true);
  }, [activeDatasetId, cache, executeInternal]);

  useEffect(() => {
    if (!autoExecute) return;
    execute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoExecute, execute, ...deps]);

  useEffect(() => {
    return () => {
      requestVersionRef.current++;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Контракт IComputeEngine.dispose: освобождаем ресурсы движка при смене
  // движка/датасета и при размонтировании (№16). Сейчас обе реализации no-op,
  // но вызов фиксирует контракт, чтобы будущая реализация не утекла.
  useEffect(() => {
    if (!activeDatasetId) return;
    return () => engine.dispose(activeDatasetId);
  }, [engine, activeDatasetId]);

  return {
    result,
    isComputing,
    error,
    recalculate,
    execute,
  };
}