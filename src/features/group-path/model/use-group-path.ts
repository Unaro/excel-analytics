'use client';
import { HierarchyFilterValue } from '@/shared/lib/validators';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useMemo } from 'react';

export function useGroupPath(): {
  path: HierarchyFilterValue[];
  setPath: (newPath: HierarchyFilterValue[]) => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const pathString = searchParams.get('path') || searchParams.get('filters');
  const searchParamsString = searchParams.toString();  // ← примитив!

  const path = useMemo<HierarchyFilterValue[]>(() => {
    if (!pathString) return [];
    try {
      return JSON.parse(decodeURIComponent(pathString));
    } catch {
      return [];
    }
  }, [pathString]);

  const setPath = useCallback((newPath: HierarchyFilterValue[]) => {
    const params = new URLSearchParams(searchParamsString);
    const newPathValue = newPath.length > 0 
      ? encodeURIComponent(JSON.stringify(newPath)) 
      : null;
    
    // Предотвращаем router.replace, если значение не изменилось
    const currentPathValue = params.get('path');
    if (currentPathValue === newPathValue) return;
    
    if (newPathValue) {
      params.set('path', newPathValue);
    } else {
      params.delete('path');
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParamsString]);  // ← строка вместо объекта

  return { path, setPath };
}