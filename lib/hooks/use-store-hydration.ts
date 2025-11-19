// hooks/use-store-hydration.ts
'use client';

import { useState, useEffect } from 'react';
import { useExcelDataStore } from '@/lib/stores/excel-data-store';

export function useStoreHydration() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Создаем асинхронную функцию внутри эффекта
    const hydrate = async () => {
      // rehydrate возвращает Promise, если storage асинхронный
      await useExcelDataStore.persist.rehydrate();
      setHydrated(true);
    };

    hydrate();
  }, []);

  return hydrated;
}