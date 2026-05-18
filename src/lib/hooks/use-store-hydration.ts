'use client';
import { useState, useEffect } from 'react';

import { useDatasetStore } from '@/entities/dataset';
import { useDashboardStore } from '@/entities/dashboard';
import { useHierarchyStore } from '@/entities/hierarchy';
import { useMetricTemplateStore } from '@/entities/metric';
import { useIndicatorGroupStore } from '@/entities/indicatorGroup';
import { useColumnConfigStore } from '@/entities/columnConfig';

interface PersistedStore {
  persist: { rehydrate: () => void | Promise<void> };
}

// РЕЕСТР СТОРОВ
const PERSISTED_STORES: PersistedStore[] = [
  useDatasetStore,
  useDashboardStore,
  useHierarchyStore,
  useMetricTemplateStore,
  useIndicatorGroupStore,
  useColumnConfigStore,
];

export function useStoreHydration() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const hydrateAll = async () => {
      try {
        await Promise.all(
          PERSISTED_STORES.map((store) => store.persist.rehydrate())
        );
        if (!cancelled) setHydrated(true);
      } catch (error) {
        console.error('[useStoreHydration] Ошибка гидратации:', error);
        // Фоллбэк: разрешаем рендер, чтобы приложение не зависло
        if (!cancelled) setHydrated(true);
      }
    };

    hydrateAll();
    return () => { cancelled = true; };
  }, []);

  return hydrated;
}