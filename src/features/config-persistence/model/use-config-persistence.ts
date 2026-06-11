// features/config-persistence/model/use-config-persistence.ts
// ─────────────────────────────────────────────────────────────
// Тонкий React-хук — UI-обёртка над чистыми сервисами.
//
// Обязанности:
//   1. Читать данные из Zustand-сторов (это ОК для feature)
//   2. Делегировать бизнес-логику в shared/lib/services/
//   3. Выполнять side-effects: download, запись в сторы, toast, router
// ─────────────────────────────────────────────────────────────

'use client';

import { logger } from '@/shared/lib/logger';
import { useCallback } from 'react';
import { useColumnConfigStore } from '@/entities/column-config';
import { useHierarchyStore } from '@/entities/hierarchy';
import { useMetricTemplateStore } from '@/entities/metric';
import { useIndicatorGroupStore } from '@/entities/indicator-group';
import { Dashboard, useDashboardStore } from '@/entities/dashboard';
import { useDatasetStore } from '@/entities/dataset';
import { createComputationCache } from '@/shared/lib/storage';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { DatasetConfigExport } from '@/entities/export-package';
import {
  DatasetConfigExportSchema,
  HierarchyFilterValue,
  IndicatorGroup,
  IndicatorGroupInDashboard,
  VirtualMetric,
  VirtualMetricBindingInDashboard,
} from '@/shared/lib/validators';
import { GroupMetricConfig, useGroupMetricConfigStore } from '@/entities/group-metric-config';
import {
  buildConfigExportPayload,
  processConfigImport,
  ConfigImportError,
} from '@/shared/lib/services';

export function useConfigPersistence() {
  const router = useRouter();

  // ───────────────────────────────────────────────────────────
  // EXPORT
  // ───────────────────────────────────────────────────────────
  const exportDatasetConfig = useCallback((datasetId: string) => {
    const allDashboards = useDashboardStore.getState().dashboards;
    const allGroups = useIndicatorGroupStore.getState().groups;
    const activeDatasetId = useDatasetStore.getState().activeDatasetId;

    try {
      const result = buildConfigExportPayload(
        {
          datasetId,
          dashboards: allDashboards,
          indicatorGroups: allGroups,
          hierarchyLevels:
            useHierarchyStore.getState().levelsByDataset[datasetId] || [],
          columnConfigs:
            useColumnConfigStore.getState().configsByDataset[datasetId] || [],
          metricTemplates: useMetricTemplateStore.getState().templates,
          groupMetricConfigs:
            useGroupMetricConfigStore.getState().configsByGroup,
        },
        activeDatasetId
      );

      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.suggestedFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const { dashboardsCount, groupsCount, groupConfigsWithColors } = result.stats;
      toast.success(
        `Экспортировано: ${dashboardsCount} дашбордов, ${groupsCount} групп` +
          (groupConfigsWithColors > 0
            ? `, ${groupConfigsWithColors} групп с настройками цвета`
            : '')
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка экспорта');
    }
  }, []);

  // ───────────────────────────────────────────────────────────
  // IMPORT
  // ───────────────────────────────────────────────────────────
  const importToDataset = useCallback(
    async (file: File, targetDatasetId: string) => {
      try {
        const fileContent = await file.text();

        const existingVmIds = collectExistingVmIds(targetDatasetId);
        const result = processConfigImport(fileContent, {
          targetDatasetId,
          existingMetricTemplates: useMetricTemplateStore.getState().templates,
          existingIndicatorGroups: useIndicatorGroupStore.getState().groups,
          existingDashboards: useDashboardStore.getState().dashboards,
          existingVmIds,
        });

        // Применяем результат к сторам
        if (result.newMetricTemplates.length > 0) {
          useMetricTemplateStore.setState((state) => ({
            templates: [...state.templates, ...result.newMetricTemplates],
          }));
        }

        useHierarchyStore
          .getState()
          .setDatasetLevels(targetDatasetId, result.hierarchyLevels);

        useColumnConfigStore
          .getState()
          .setDatasetConfigs(targetDatasetId, result.columnConfigs);

        useIndicatorGroupStore.setState({
          groups: result.mergedIndicatorGroups,
        });

        useDashboardStore.setState({
          dashboards: result.mergedDashboards,
        });

        if (
          result.importedGroupMetricConfigs &&
          Object.keys(result.importedGroupMetricConfigs).length > 0
        ) {
          useGroupMetricConfigStore
            .getState()
            .importConfigs(result.importedGroupMetricConfigs);
        }

        // Инвалидация кэша
        await invalidateComputationCache(targetDatasetId);

        const { stats } = result;
        const conflictNote =
          stats.vmIdConflicts > 0
            ? `\n⚠️ ${stats.vmIdConflicts} VM ID переименовано (конфликты)`
            : '';

        toast.success(
          `Конфиг применён: ${stats.dashboardsImported} дашбордов, ` +
            `${stats.groupsImported} групп, ${stats.hierarchyLevelsImported} уровней` +
            (stats.groupConfigsWithColors > 0
              ? `, ${stats.groupConfigsWithColors} групп с настройками цвета`
              : '') +
            conflictNote,
          { duration: stats.vmIdConflicts > 0 ? 8000 : 4000 }
        );
        router.refresh();
      } catch (e) {
        logger.error('[ConfigImport] Error:', e);
        const message =
          e instanceof ConfigImportError
            ? e.message
            : e instanceof Error
              ? e.message
              : 'Ошибка импорта';
        toast.error(message);
      }
    },
    [router]
  );

  return { exportDatasetConfig, importToDataset };
}

/**
 * Собирает Set всех virtualMetricId существующих дашбордов целевого датасета.
 * Вызывается через getState() — не нарушает правила хуков.
 */
function collectExistingVmIds(targetDatasetId: string): Set<string> {
  const ids = new Set<string>();
  for (const dashboard of useDashboardStore.getState().dashboards) {
    if (dashboard.datasetId === targetDatasetId) {
      for (const vm of dashboard.virtualMetrics) {
        ids.add(vm.id);
      }
    }
  }
  return ids;
}

// ─────────────────────────────────────────────────────────────
// Вспомогательная функция — инвалидация кэша
// ─────────────────────────────────────────────────────────────
async function invalidateComputationCache(datasetId: string): Promise<void> {
  try {
    const fileCache = createComputationCache('file');
    await fileCache.clear(datasetId);
  } catch (err) {
    logger.warn('[ConfigImport] File cache invalidation failed:', err);
  }
  try {
    const pgCache = createComputationCache('postgres');
    await pgCache.clear(datasetId);
  } catch (err) {
    logger.warn('[ConfigImport] PG cache invalidation failed:', err);
  }
}