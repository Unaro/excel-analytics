'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { HierarchyFilterValue } from '@/types';

export function useUrlFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Чтение фильтров из URL
  const filters = useMemo<HierarchyFilterValue[]>(() => {
    const param = searchParams.get('filters');
    if (!param) return [];
    try {
      return JSON.parse(decodeURIComponent(param));
    } catch {
      return [];
    }
  }, [searchParams]);

  // Запись фильтров в URL
  const setFilters = useCallback((newFilters: HierarchyFilterValue[]) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (newFilters.length > 0) {
      params.set('filters', encodeURIComponent(JSON.stringify(newFilters)));
    } else {
      params.delete('filters');
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  return { filters, setFilters };
}