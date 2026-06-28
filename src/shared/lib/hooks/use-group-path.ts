'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { encodePathValues, decodePathValues } from './group-path-codec';

export interface GroupPathReturn {
  /** Значения уровней пути (только value). Полный HierarchyFilterValue[]
   *  собирает потребитель, дополняя поля из иерархии. */
  pathValues: string[];
  setPathValues: (values: string[]) => void;
}

/**
 * Путь иерархии текущей группы в query-параметре `path` URL — КОМПАКТНО, только
 * значения уровней через «/» (см. group-path-codec). Читает также легаси `path`
 * (старый JSON) и `filters` (приход с дашборда), мигрируя на новый формат при
 * первой записи. Запись — router.replace без скролла.
 */
export function useGroupPath(): GroupPathReturn {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // get() уже декодирует один слой URL-кодирования.
  const raw = searchParams.get('path') ?? searchParams.get('filters');
  const searchParamsString = searchParams.toString();

  const pathValues = useMemo(() => decodePathValues(raw), [raw]);

  const setPathValues = useCallback(
    (values: string[]) => {
      const params = new URLSearchParams(searchParamsString);
      const next = values.length > 0 ? encodePathValues(values) : null;

      // Легаси `filters` перебивает чтение, пока есть; сброс к корню
      // (next=null) был бы no-op и откатил к фильтру дашборда — поэтому при его
      // наличии запись обязательна. Сам параметр удаляем (миграция на `path`).
      const hasLegacyFilters = params.has('filters');
      if (params.get('path') === next && !hasLegacyFilters) return;

      if (next) params.set('path', next);
      else params.delete('path');
      params.delete('filters');

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParamsString]
  );

  return { pathValues, setPathValues };
}
