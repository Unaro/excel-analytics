'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { HierarchyFilterValue } from '@/types';

export function useUrlFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // ✅ Читаем только строку, а не весь объект searchParams
  const filtersString = searchParams.get('filters');
  
  // ✅ Мемоизируем по строке, а не по объекту
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
    const params = new URLSearchParams(searchParams.toString());

    if (newFilters.length > 0) {
      params.set('filters', encodeURIComponent(JSON.stringify(newFilters)));
    } else {
      params.delete('filters');
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams.toString()]);

  return { filters, setFilters };
}