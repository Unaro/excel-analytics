'use client';
import { useState, useEffect, useRef } from 'react';
import { useDatasetStore } from '@/entities/dataset';
import { useDashboardStore } from '@/entities/dashboard';
import { useHierarchyStore } from '@/entities/hierarchy';
import { useMetricTemplateStore } from '@/entities/metric';
import { useIndicatorGroupStore } from '@/entities/indicatorGroup';
import { useColumnConfigStore } from '@/entities/columnConfig';
import { get, set } from 'idb-keyval';
import { rowsToArrowBuffer } from '@/features/computation/lib/duckdb/arrow-converter';
import { duckdbManager } from '@/features/computation/lib/duckdb/manager';
import { toast } from '@/shared/ui/toast';

/**
 * Глобальный флаг, предотвращающий повторный запуск гидратации DuckDB.
 * КРИТИЧНО для React StrictMode в dev-режиме, где useEffect вызывается дважды.
 */
let globalHydrationStarted = false;

/**
 * Список всех persisted-сторов, которые нужно дождаться перед восстановлением DuckDB.
 * Порядок важен: dataset должен быть последним, т.к. мы на него опираемся.
 */
const STORES_TO_HYDRATE = [
  useDashboardStore,
  useHierarchyStore,
  useMetricTemplateStore,
  useIndicatorGroupStore,
  useColumnConfigStore,
  useDatasetStore,
] as const;

export function useStoreHydration() {
  const [hydrated, setHydrated] = useState(false);
  const localStartedRef = useRef(false);

  useEffect(() => {
    // Защита от StrictMode (double-invocation) и множественных монтирований
    if (globalHydrationStarted || localStartedRef.current) {
      // Если гидратация уже была запущена где-то ещё — просто слушаем состояние
      const unsub = useDatasetStore.persist.onFinishHydration(() => {
        setHydrated(true);
      });
      if (useDatasetStore.persist.hasHydrated()) {
        setHydrated(true);
      }
      return () => unsub();
    }

    globalHydrationStarted = true;
    localStartedRef.current = true;
    let cancelled = false;

    // ───────────────────────────────────────────────────────────────────
    // КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: Ждём onFinishHydration у ВСЕХ сторов
    // ───────────────────────────────────────────────────────────────────
    const hydrationPromises = STORES_TO_HYDRATE.map((store) => {
      return new Promise<void>((resolve) => {
        // Если уже гидратирован — сразу резолвим
        if (store.persist.hasHydrated()) {
          resolve();
          return;
        }
        const unsub = store.persist.onFinishHydration(() => {
          unsub();
          resolve();
        });
      });
    });

    const runHydration = async () => {
      try {
        // 1. Ждём завершение гидратации ВСЕХ сторов
        await Promise.all(hydrationPromises);
        if (cancelled) return;

        console.log('[Hydration] ✅ All stores hydrated, starting DuckDB restore...');

        // 2. ТЕПЕРЬ getState() вернёт реально гидратированные данные
        const datasetState = useDatasetStore.getState();

        // 3. Параллельно восстанавливаем все file-датасеты
        const restorePromises = Object.entries(datasetState.datasets)
          .filter(([_, ds]) => ds.sourceType === 'file')
          .map(async ([id, ds]) => {
            if (ds.engineStatus === 'ready') {
              if (ds.rows && ds.rows.length > 0) {
                return; // Всё ок, ничего не делаем
              }
              try {
                const preview = await duckdbManager.getPreviewRows(id, 500);
                useDatasetStore.getState().setDatasetRows(id, preview);
                console.log(`[Hydration] ✅ Preview re-fetched for already-ready ${id}: ${preview.length} rows`);
              } catch (err) {
                console.warn(`[Hydration] Preview re-fetch failed for ${id}:`, err);
              }
              return;
            }

            if (ds.engineStatus === 'error') {
              console.warn(`[Hydration] Skipping ${id} — previous error state`);
              return;
            }

            useDatasetStore.getState().updateDataset(id, { engineStatus: 'loading' });
            // Внутри цикла восстановления датасетов
            try {
              // 3.1. Читаем Arrow-буфер из IndexedDB
              let arrowBuffer: Uint8Array | null = null;
              try {
                const existingBuffer = await get(`arrow:${id}`);
                if (existingBuffer instanceof Uint8Array && existingBuffer.byteLength > 0) {
                  arrowBuffer = existingBuffer;
                  console.log(`[Hydration] ✅ Arrow buffer found in cache: ${(arrowBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);
                }
              } catch (cacheErr) {
                console.warn(`[Hydration] Cache read failed for ${id}:`, cacheErr);
              }

              // 3.2. Fallback: если кэша нет, но есть rows в store (маловероятно)
              if (!arrowBuffer && ds.rows && ds.rows.length > 0) {
                try {
                  arrowBuffer = rowsToArrowBuffer(ds.rows);
                  await set(`arrow:${id}`, arrowBuffer);
                  console.log(`[Hydration] ✅ Arrow buffer rebuilt from rows: ${(arrowBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);
                } catch (rebuildErr) {
                  console.error(`[Hydration] Buffer rebuild failed for ${id}:`, rebuildErr);
                }
              }

              // 3.3. Если buffer всё ещё null — помечаем как error и предлагаем перезагрузить
              if (!arrowBuffer) {
                console.error(`[Hydration] ❌ Arrow buffer not found for ${id}. User needs to reload the file.`);
                useDatasetStore.getState().updateDataset(id, { 
                  engineStatus: 'error' 
                });
                // Показываем пользователю понятное сообщение
                toast.error(`Датасет "${ds.name}" не удалось восстановить. Загрузите файл заново.`, {
                  duration: 10000,
                  action: {
                    label: 'Перейти к загрузке',
                    onClick: () => window.location.href = '/setup'
                  }
                });
                return; // Пропускаем этот датасет
              }

              // 3.4. Регистрируем буфер в DuckDB
              await duckdbManager.registerArrowBuffer(id, arrowBuffer);

              // 3.5. Восстанавливаем PREVIEW для UI
              try {
                const previewRows = await duckdbManager.getPreviewRows(id, 500);
                useDatasetStore.getState().setDatasetRows(id, previewRows);
                console.log(`[Hydration] ✅ Preview restored for ${id}: ${previewRows.length} rows`);
              } catch (previewErr) {
                console.warn(`[Hydration] Preview restore failed for ${id}:`, previewErr);
              }

              useDatasetStore.getState().updateDataset(id, { engineStatus: 'ready' });
            } catch (err) {
              console.error(`[Hydration] ❌ Failed to restore dataset ${id}:`, err);
              useDatasetStore.getState().updateDataset(id, { engineStatus: 'error' });
            }
          });

        await Promise.all(restorePromises);
        if (!cancelled) {
          console.log('[Hydration] 🎉 All datasets restored');
          setHydrated(true);
        }
      } catch (error) {
        console.error('[Hydration] Critical error:', error);
        if (!cancelled) setHydrated(true); // Всё равно считаем гидратацию завершённой
      }
    };

    runHydration();

    return () => {
      cancelled = true;
    };
  }, []);

  return hydrated;
}