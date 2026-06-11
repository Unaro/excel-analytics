'use client';

import { HierarchyFilterValue } from '@/shared/lib/validators';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useMemo } from 'react';

export interface GroupPathReturn {
  path: HierarchyFilterValue[];
  setPath: (newPath: HierarchyFilterValue[]) => void;
}

/**
 * Путь иерархии текущей группы в query-параметре `path` URL
 * (читает также legacy-параметр `filters`). Запись — router.replace
 * без скролла.
 */
export function useGroupPath(): GroupPathReturn {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const pathString = searchParams.get('path') || searchParams.get('filters');
  const searchParamsString = searchParams.toString();

  const path = useMemo<HierarchyFilterValue[]>(() => {
    if (!pathString) return [];
    try {
      return JSON.parse(decodeURIComponent(pathString));
    } catch {
      return [];
    }
  }, [pathString]);

  const setPath = useCallback(
    (newPath: HierarchyFilterValue[]) => {
      const params = new URLSearchParams(searchParamsString);
      const newPathValue = newPath.length > 0 ? encodeURIComponent(JSON.stringify(newPath)) : null;

      const currentPathValue = params.get('path');
      if (currentPathValue === newPathValue) return;

      if (newPathValue) {
        params.set('path', newPathValue);
      } else {
        params.delete('path');
      }

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParamsString]
  );

  return { path, setPath };
}