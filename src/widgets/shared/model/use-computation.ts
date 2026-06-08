'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createComputationCache, type IComputationCache, type CacheKey } from '@/shared/lib/storage';
import { createComputeEngine } from '@/shared/lib/computation/lib/engine-factory';
import type { ClientComputeParams, IComputeEngine } from '@/shared/lib/computation/lib/types';
import type { DashboardComputationResult } from '@/shared/lib/types/computation';

export interface UseComputationOptions {
  /** Активный ID датасета (или null) */
  activeDatasetId: string | null;
  /** Источник данных ('file' | 'postgres') */
  sourceType: 'file' | 'postgres';
  /** Флаг синхронизации — пока true, вычисления не стартуют */
  isSyncing: boolean;
  /** Функция построения параметров вычисления. Возвращает null, если не готово */
  buildParams: () => ClientComputeParams | null;
  /** Функция построения ключа кэша */
  buildCacheKey: () => CacheKey | null;
  /** Задержка debounce в ms (по умолчанию 100) */
  debounceMs?: number;
  /** Автоматически запускать при изменении cacheKey (по умолчанию true) */
  autoExecute?: boolean;
  /** Зависимости для перезапуска вычислений (помимо buildParams/buildCacheKey) */
  deps?: unknown[];
}

export interface UseComputationResult {
  result: DashboardComputationResult | null;
  isComputing: boolean;
  error: string | null;
  /** Принудительный пересчёт с инвалидацией кэша */
  recalculate: () => Promise<void>;
  /** Ручной запуск (если autoExecute=false) */
  execute: () => Promise<void>;
}

/**
 * Единый хук для вычислений DuckDB / PostgreSQL.
 *
 * Гарантирует:
 *   - AbortController для отмены устаревших запросов
 *   - Request versioning (только последний результат попадает в state)
 *   - Debounce для защиты от spam-запросов
 *   - Автоматическое кэширование через IComputationCache
 *   - Обработку ошибок и состояния загрузки
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
}: UseComputationOptions): UseComputationResult {
  const [result, setResult] = useState<DashboardComputationResult | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Request versioning — каждый запуск инкрементирует счётчик
  const requestVersionRef = useRef(0);
  // Debounce timer
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Мемоизированный engine и cache
  const engine: IComputeEngine = useMemo(
    () => createComputeEngine(sourceType),
    [sourceType]
  );
  const cache: IComputationCache = useMemo(
    () => createComputationCache(sourceType),
    [sourceType]
  );

  /**
   * Ядро вычисления с AbortController и versioning.
   * Если во время выполнения придёт новый запрос — старый игнорируется.
   */
  const executeInternal = useCallback(
    async (force = false): Promise<void> => {
      if (!activeDatasetId || isSyncing) return;

      const params = buildParams();
      const cacheKey = buildCacheKey();
      if (!params || !cacheKey) return;

      const currentVersion = ++requestVersionRef.current;

      setIsComputing(true);
      setError(null);

      try {
        // 1. Проверяем кэш (если не force)
        if (!force) {
          const cached = await cache.get(cacheKey);
          if (cached && currentVersion === requestVersionRef.current) {
            setResult(cached.result);
            setIsComputing(false);
            return;
          }
        }

        // 2. Инициализируем engine
        await engine.initialize(activeDatasetId);

        // 3. Проверяем version после async операции
        if (currentVersion !== requestVersionRef.current) return;

        // 4. Выполняем вычисление
        const computedResult = await engine.compute(params);

        // 5. Финальная проверка version перед записью в state
        if (currentVersion !== requestVersionRef.current) return;

        setResult(computedResult);
        setIsComputing(false);

        // 6. Сохраняем в кэш (не ждём)
        cache.set(cacheKey, computedResult).catch(err => {
          console.warn('[useComputation] Cache save failed:', err);
        });
      } catch (err) {
        // Игнорируем ошибки отменённых запросов
        if (currentVersion !== requestVersionRef.current) return;

        console.error('[useComputation] Compute failed:', err);
        setError(err instanceof Error ? err.message : 'Ошибка вычисления');
        setIsComputing(false);
      }
    },
    [activeDatasetId, isSyncing, buildParams, buildCacheKey, cache, engine]
  );

  /**
   * Публичный метод: debounce + запуск
   */
  const execute = useCallback(async (): Promise<void> => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    return new Promise<void>(resolve => {
      debounceTimerRef.current = setTimeout(() => {
        executeInternal(false).finally(resolve);
      }, debounceMs);
    });
  }, [executeInternal, debounceMs]);

  /**
   * Принудительный пересчёт (инвалидирует кэш для конкретного ключа)
   */
  const recalculate = useCallback(async (): Promise<void> => {
    if (!activeDatasetId) return;
    const cacheKey = buildCacheKey();
    if (cacheKey) {
      try {
        await cache.invalidate(cacheKey);
      } catch (err) {
        console.warn('[useComputation] Cache invalidate failed:', err);
      }
    }
    await executeInternal(true);
  }, [activeDatasetId, buildCacheKey, cache, executeInternal]);

  // Auto-execute при изменении зависимостей
  useEffect(() => {
    if (!autoExecute) return;
    execute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoExecute, execute, ...deps]);

  // Cleanup при unmount — отменяем все pending запросы
  useEffect(() => {
    return () => {
      requestVersionRef.current++;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    result,
    isComputing,
    error,
    recalculate,
    execute,
  };
}