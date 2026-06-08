// shared/lib/services/dashboard-filter-reconciler.ts
// ─────────────────────────────────────────────────────────────
// Чистая функция согласования иерархических фильтров с валидными
// колонками датасета.
//
// Используется после замены файла или изменения структуры данных,
// когда некоторые колонки могли быть удалены и фильтры стали
// невалидными (ссылаются на несуществующие колонки).
// ─────────────────────────────────────────────────────────────

import type { HierarchyFilterValue } from '@/shared/lib/validators';

// ─────────────────────────────────────────────────────────────
// Публичные типы
// ─────────────────────────────────────────────────────────────

export interface FilterReconciliationResult {
  /** Фильтры, которые остались валидными */
  validFilters: HierarchyFilterValue[];
  /** Фильтры, которые стали невалидными */
  invalidFilters: HierarchyFilterValue[];
  /** true, если есть хотя бы один невалидный фильтр */
  hasInvalid: boolean;
}

// ─────────────────────────────────────────────────────────────
// Публичная функция
// ─────────────────────────────────────────────────────────────

/**
 * Проверяет, какие фильтры ссылаются на существующие колонки.
 *
 * @param filters - текущие фильтры дашборда
 * @param validColumnNames - Set или массив имён валидных колонок
 */
export function reconcileHierarchyFilters(
  filters: HierarchyFilterValue[],
  validColumnNames: Set<string> | string[]
): FilterReconciliationResult {
  const validSet =
    validColumnNames instanceof Set
      ? validColumnNames
      : new Set(validColumnNames);

  const validFilters: HierarchyFilterValue[] = [];
  const invalidFilters: HierarchyFilterValue[] = [];

  for (const filter of filters) {
    if (validSet.has(filter.columnName)) {
      validFilters.push(filter);
    } else {
      invalidFilters.push(filter);
    }
  }

  return {
    validFilters,
    invalidFilters,
    hasInvalid: invalidFilters.length > 0,
  };
}