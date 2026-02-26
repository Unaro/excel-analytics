'use client';

import { useState, useEffect } from 'react';
import { useExcelDataStore } from '@/entities/excelData';
import { useDashboardStore } from '@/entities/dashboard';
import { useHierarchyStore } from '@/entities/hierarchy';
import { useMetricTemplateStore } from '@/entities/metric';
import { useIndicatorGroupStore } from '@/entities/indicatorGroup';
import { useColumnConfigStore } from '@/entities/excelData';

export function useStoreHydration() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      try {
        // ✅ Гидратируем ВСЕ сторы с persist параллельно
        await Promise.all([
          useExcelDataStore.persist.rehydrate(),
          useDashboardStore.persist.rehydrate(),
          useHierarchyStore.persist.rehydrate(),
          useMetricTemplateStore.persist.rehydrate(),
          useIndicatorGroupStore.persist.rehydrate(),
          useColumnConfigStore.persist.rehydrate(),
        ]);
        
        if (!cancelled) {
          setHydrated(true);
        }
      } catch (error) {
        console.error('Hydration failed:', error);
        // Даже при ошибке продолжаем — покажем пустое состояние
        if (!cancelled) {
          setHydrated(true);
        }
      }
    };

    hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  return hydrated;
}