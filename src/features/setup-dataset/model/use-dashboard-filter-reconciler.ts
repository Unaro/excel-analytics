// features/setup-dataset/model/use-dashboard-filter-reconciler.ts
// ─────────────────────────────────────────────────────────────
// Feature-level хук для согласования фильтров дашборда после
// изменения структуры данных (замены файла).
//
// Отвечает за:
//   - Чтение данных из entities (dashboardStore, datasetStore)
//   - Делегирование валидации в чистый shared-сервис
//   - Применение изменений к store
//   - UI-уведомления (toast)
// ─────────────────────────────────────────────────────────────

'use client';

import { useCallback } from 'react';
import { useDatasetStore } from '@/entities/dataset';
import { useDashboardStore } from '@/entities/dashboard';
import { reconcileHierarchyFilters } from '@/shared/lib/services';
import { toast } from '@/shared/ui/toast';

/**
 * Хук для согласования фильтров дашборда после изменения структуры данных.
 * Удаляет фильтры, ссылающиеся на колонки, которых больше нет в датасете.
 *
 * Улучшение над старым `reconcileDashboardFilters`:
 *   - Старая версия: при любом невалидном фильтре сбрасывала ВСЕ фильтры
 *   - Новая версия: удаляет ТОЛЬКО невалидные, сохраняя остальные
 */
export function useDashboardFilterReconciler() {
  const reconcile = useCallback((dashboardId: string) => {
    const headers = useDatasetStore.getState().getHeaders();
    const dashboard = useDashboardStore.getState().getDashboard(dashboardId);

    if (!dashboard || headers.length === 0) return;

    const validColumns = new Set(headers);
    const { validFilters, invalidFilters, hasInvalid } =
      reconcileHierarchyFilters(dashboard.hierarchyFilters, validColumns);

    if (hasInvalid) {
      useDashboardStore
        .getState()
        .setHierarchyFilters(dashboardId, validFilters);

      const removedNames = invalidFilters
        .map((f) => f.columnName)
        .filter((v, i, a) => a.indexOf(v) === i) // уникальные
        .slice(0, 3)
        .join(', ');
      const more =
        invalidFilters.length > 3
          ? ` и ещё ${invalidFilters.length - 3}`
          : '';

      toast.warning(
        `Удалено ${invalidFilters.length} устаревш${
          invalidFilters.length === 1 ? 'ий' : 'их'
        } фильтр${invalidFilters.length === 1 ? '' : 'ов'}: ${removedNames}${more}`,
        { duration: 6000 }
      );
    }
  }, []);

  /**
   * Массовое согласование для всех дашбордов датасета.
   * Вызывается после замены файла.
   */
  const reconcileAllForDataset = useCallback(
    (datasetId: string) => {
      const dashboards = useDashboardStore.getState().dashboards;
      const datasetDashboards = dashboards.filter(
        (d) => d.datasetId === datasetId
      );
      for (const dashboard of datasetDashboards) {
        reconcile(dashboard.id);
      }
    },
    [reconcile]
  );

  return { reconcile, reconcileAllForDataset };
}