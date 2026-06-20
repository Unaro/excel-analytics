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
      // legacy `filters` (заход с дашборда) перебивает чтение при отсутствии
      // `path`. Пока он есть — навигация ОБЯЗАНА перезаписать URL, иначе сброс
      // к корню (newPathValue=null) становится no-op и откатывает к исходному
      // фильтру дашборда. Учитываем его в no-op-проверке и удаляем при записи.
      const hasLegacyFilters = params.has('filters');
      if (currentPathValue === newPathValue && !hasLegacyFilters) return;

      if (newPathValue) {
        params.set('path', newPathValue);
      } else {
        params.delete('path');
      }
      // Однократная миграция: после первой навигации легаси-параметр убираем,
      // дальше единственный источник пути — `path`.
      params.delete('filters');

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParamsString]
  );

  return { path, setPath };
}