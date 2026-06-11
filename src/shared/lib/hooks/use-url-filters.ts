'use client';

import { HierarchyFilterValue } from '@/shared/lib/validators';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useMemo } from 'react';

/**
 * Синхронизация фильтров иерархии с query-параметром `filters` URL.
 *
 * Чтение мемоизировано по сырой строке параметра; запись — через
 * router.replace без скролла (фильтрация не считается навигацией).
 */
export function useUrlFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filtersString = searchParams.get('filters');
  const searchParamsString = searchParams.toString();
  
  // Мемоизируем по строке
  const filters = useMemo<HierarchyFilterValue[]>(() => {
    if (!filtersString) return [];
    try {
      return JSON.parse(decodeURIComponent(filtersString));
    } catch {
      return [];
    }
  }, [filtersString]);

  // Запись фильтров в URL
  const setFilters = useCallback((newFilters: HierarchyFilterValue[]) => {
    const params = new URLSearchParams(searchParamsString);

    if (newFilters.length > 0) {
      params.set('filters', encodeURIComponent(JSON.stringify(newFilters)));
    } else {
      params.delete('filters');
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParamsString]);

  return { filters, setFilters };
}