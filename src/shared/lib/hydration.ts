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

let globalHydrationStarted = false;

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
        const restorePromises = Object.entries(datasetState.datasets)
          .filter(([_, ds]) => ds.sourceType === 'file')
          .map(async ([id, ds]) => {
            if (ds.engineStatus === 'ready') {
              if (ds.rows && ds.rows.length > 0) return;
              try {
                const preview = await duckdbManager.getPreviewRows(id, 500);
                useDatasetStore.getState().setDatasetRows(id, preview);
              } catch (err) {
                console.warn(`[Hydration] Preview re-fetch failed for ${id}:`, err);
              }
              return;
            }
            if (ds.engineStatus === 'error') return;
            useDatasetStore.getState().updateDataset(id, { engineStatus: 'loading' });
            try {
              let arrowBuffer: Uint8Array | null = null;
              try {
                const existingBuffer = await get(`arrow:${id}`);
                if (existingBuffer instanceof Uint8Array && existingBuffer.byteLength > 0) {
                  arrowBuffer = existingBuffer;
                }
              } catch (cacheErr) {
                console.warn(`[Hydration] Cache read failed for ${id}:`, cacheErr);
              }
              if (!arrowBuffer && ds.rows && ds.rows.length > 0) {
                try {
                  arrowBuffer = rowsToArrowBuffer(ds.rows);
                  await set(`arrow:${id}`, arrowBuffer);
                } catch (rebuildErr) {
                  console.error(`[Hydration] Buffer rebuild failed for ${id}:`, rebuildErr);
                }
              }
              if (!arrowBuffer) {
                useDatasetStore.getState().updateDataset(id, { engineStatus: 'error' });
                toast.error(`Датасет "${ds.name}" не удалось восстановить. Загрузите файл заново.`, {
                  duration: 10000,
                  action: { label: 'Перейти к загрузке', onClick: () => window.location.href = '/setup' }
                });
                return;
              }
              await duckdbManager.registerArrowBuffer(id, arrowBuffer);
              try {
                const previewRows = await duckdbManager.getPreviewRows(id, 500);
                useDatasetStore.getState().setDatasetRows(id, previewRows);
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
        if (!cancelled) setHydrated(true);
      } catch (error) {
        console.error('[Hydration] Critical error:', error);
        if (!cancelled) setHydrated(true);
      }
    };
    runHydration();
    return () => { cancelled = true; };
  }, []);

  return hydrated;
}

export function ClientOnly({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);
  if (!isMounted) return fallback
  return children
}