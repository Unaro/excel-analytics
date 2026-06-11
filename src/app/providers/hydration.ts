// ─────────────────────────────────────────────────────────────
// Application-level bootstrapper для восстановления состояния.
//
// ─────────────────────────────────────────────────────────────

'use client';

import { logger } from '@/shared/lib/logger';
import { useState, useEffect, useRef } from 'react';
import { useDatasetStore } from '@/entities/dataset';
import { useDashboardStore } from '@/entities/dashboard';
import { useHierarchyStore } from '@/entities/hierarchy';
import { useMetricTemplateStore } from '@/entities/metric';
import { useIndicatorGroupStore } from '@/entities/indicator-group';
import { useColumnConfigStore } from '@/entities/column-config';
import { get, set } from 'idb-keyval';
import { rowsToArrowBuffer } from '@/shared/lib/computation/lib/duckdb/arrow-converter';
import { duckdbManager } from '@/shared/lib/computation/lib/duckdb/manager';
import { toast } from '@/shared/ui/toast';
import type { DatasetEntry } from '@/entities/dataset';

// Защита от повторного запуска
let globalHydrationStarted = false;

const STORES_TO_HYDRATE = [
  useDashboardStore,
  useHierarchyStore,
  useMetricTemplateStore,
  useIndicatorGroupStore,
  useColumnConfigStore,
  useDatasetStore,
] as const;

/**
 * Глобальный хук гидрации Zustand-сторов из IndexedDB.
 * Вызывается ОДИН РАЗ при монтировании корневого layout.
 *
 * Отвечает за:
 * 1. Ожидание завершения гидрации всех сторов
 * 2. Параллельное восстановление file-датасетов из Arrow buffer
 * 3. Уведомление пользователя о проблемах восстановления
 */
export function useStoreHydration() {
  const [hydrated, setHydrated] = useState(false);
  const localStartedRef = useRef(false);

  useEffect(() => {
    if (globalHydrationStarted || localStartedRef.current) {
      const unsub = useDatasetStore.persist.onFinishHydration(() => setHydrated(true));
      if (useDatasetStore.persist.hasHydrated()) setHydrated(true);
      return () => unsub();
    }

    globalHydrationStarted = true;
    localStartedRef.current = true;

    let cancelled = false;

    const hydrationPromises = STORES_TO_HYDRATE.map((store) => {
      return new Promise<void>((resolve) => {
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
        await Promise.all(hydrationPromises);
        if (cancelled) return;

        const datasetState = useDatasetStore.getState();
        const fileEntries = Object.entries(datasetState.datasets).filter(
          ([, ds]) => ds.sourceType === 'file'
        );

        // Параллельное восстановление всех file-датасетов
        const results = await Promise.allSettled(
          fileEntries.map(([id, ds]) => restoreFileDataset(id, ds))
        );

        // Подсчёт ошибок
        let failCount = 0;
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value === false) failCount++;
          else if (r.status === 'rejected') failCount++;
        }

        if (failCount > 0 && !cancelled) {
          const plural = failCount === 1 ? '' : 'ов';
          toast.error(
            `Не удалось восстановить ${failCount} датасет${plural}. ` +
            `Перейдите в "Данные и Колонки" для повторной загрузки.`,
            {
              duration: 10000,
              action: {
                label: 'Перейти к загрузке',
                onClick: () => { window.location.href = '/setup'; },
              },
            }
          );
        }

        if (!cancelled) setHydrated(true);
      } catch (error) {
        logger.error('[Hydration] Critical error:', error);
        if (!cancelled) setHydrated(true);
      }
    };

    runHydration();

    return () => { cancelled = true; };
  }, []);

  return hydrated;
}

/**
 * Восстанавливает один file-датасет из Arrow buffer в IndexedDB.
 * Использует ТОЛЬКО `registerArrowBuffer` — это сообщение есть
 * в любой версии worker.ts, поэтому работает всегда.
 */
async function restoreFileDataset(id: string, ds: DatasetEntry): Promise<boolean> {
  const datasetStore = useDatasetStore.getState();

  // Пропускаем уже готовые
  if (ds.engineStatus === 'ready') {
    // Проверим preview, если rows пустые
    if (!ds.rows || ds.rows.length === 0) {
      try {
        const preview = await duckdbManager.getPreviewRows(id, 500);
        datasetStore.setDatasetRows(id, preview);
      } catch (err) {
        logger.warn(`[Hydration] Preview re-fetch failed for ${id}:`, err);
      }
    }
    return true;
  }

  // Пропускаем уже сломанные
  if (ds.engineStatus === 'error') return false;

  // Помечаем как loading
  datasetStore.updateDataset(id, { engineStatus: 'loading' });

  try {
    // 1. Достаём Arrow buffer из IDB
    let arrowBuffer: Uint8Array | null = null;
    let bufferSizeBytes = 0;
    let bufferSource: 'idb' | 'rebuilt' | null = null;

    try {
      const existingBuffer = await get<Uint8Array>(`arrow:${id}`);
      if (existingBuffer instanceof Uint8Array && existingBuffer.byteLength > 0) {
        arrowBuffer = existingBuffer;
        bufferSizeBytes = existingBuffer.byteLength;
        bufferSource = 'idb';
        logger.debug(
          `[Hydration] 📦 Arrow buffer loaded from IDB for ${id}: ` +
          `${(bufferSizeBytes / 1024 / 1024).toFixed(2)} MB`
        );
      }
    } catch (cacheErr) {
      logger.warn(`[Hydration] Cache read failed for ${id}:`, cacheErr);
    }

    // 2. Fallback: восстановление из preview rows
    if (!arrowBuffer && ds.rows && ds.rows.length > 0) {
      try {
        arrowBuffer = rowsToArrowBuffer(ds.rows);
        bufferSizeBytes = arrowBuffer.byteLength;
        bufferSource = 'rebuilt';
        await set(`arrow:${id}`, arrowBuffer);
        logger.debug(
          `[Hydration] ♻️ Arrow buffer rebuilt from ${ds.rows.length} rows for ${id}: ` +
          `${(bufferSizeBytes / 1024 / 1024).toFixed(2)} MB`
        );
      } catch (rebuildErr) {
        logger.error(`[Hydration] Buffer rebuild failed for ${id}:`, rebuildErr);
      }
    }

    // 3. Если буфера нет — датасет потерян
    if (!arrowBuffer) {
      datasetStore.updateDataset(id, { engineStatus: 'error' });
      toast.error(
        `Датасет "${ds.name}" не удалось восстановить. Загрузите файл заново.`,
        {
          duration: 10000,
          action: {
            label: 'Перейти к загрузке',
            onClick: () => { window.location.href = '/setup'; },
          },
        }
      );
      return false;
    }

    // 4. Регистрируем таблицу через REGISTER_ARROW.
    await duckdbManager.registerArrowBuffer(id, arrowBuffer);

    // 5. Восстанавливаем preview rows (500 строк для UI).
    try {
      const preview = await duckdbManager.getPreviewRows(id, 500);
      datasetStore.setDatasetRows(id, preview);
    } catch (previewErr) {
      logger.warn(`[Hydration] Preview fetch failed for ${id}:`, previewErr);
    }

    datasetStore.updateDataset(id, { engineStatus: 'ready' });

    const sourceLabel = bufferSource === 'idb' ? 'IDB' : 'rebuilt';
    logger.debug(
      `[Hydration] ✅ Dataset ${id} restored successfully ` +
      `(${(bufferSizeBytes / 1024 / 1024).toFixed(2)} MB from ${sourceLabel})`
    );
    return true;
  } catch (err) {
    logger.error(`[Hydration] ❌ Failed to restore dataset ${id}:`, err);
    datasetStore.updateDataset(id, { engineStatus: 'error' });
    return false;
  }
}