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

import { useCallback } from 'react';
import { useColumnConfigStore } from '@/entities/columnConfig';
import { useHierarchyStore } from '@/entities/hierarchy';
import { useMetricTemplateStore } from '@/entities/metric';
import { useIndicatorGroupStore } from '@/entities/indicatorGroup';
import { useDashboardStore } from '@/entities/dashboard';
import { useDatasetStore } from '@/entities/dataset';
import { useGroupMetricConfigStore } from '@/entities/groupMetricConfig';
import { createComputationCache } from '@/shared/lib/storage';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
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
    // 1. Собираем контекст из сторов
    const activeDatasetId = useDatasetStore.getState().activeDatasetId;
    const context = {
      datasetId,
      dashboards: useDashboardStore.getState().dashboards,
      indicatorGroups: useIndicatorGroupStore.getState().groups,
      hierarchyLevels:
        useHierarchyStore.getState().levelsByDataset[datasetId] || [],
      columnConfigs:
        useColumnConfigStore.getState().configsByDataset[datasetId] || [],
      metricTemplates: useMetricTemplateStore.getState().templates,
      groupMetricConfigs: useGroupMetricConfigStore.getState().configsByGroup,
    };

    // 2. Делегируем логику в чистый сервис
    const result = buildConfigExportPayload(context, activeDatasetId);

    // 3. Проверяем, есть ли что экспортировать
    if (result.stats.dashboardsCount === 0 && result.stats.groupsCount === 0) {
      toast.warning('Нечего экспортировать');
      return;
    }

    // 4. Скачиваем файл
    const url = URL.createObjectURL(result.blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = result.suggestedFileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    // 5. Уведомляем пользователя
    const { dashboardsCount, groupsCount, groupConfigsWithColors } = result.stats;
    toast.success(
      `Экспортировано: ${dashboardsCount} дашбордов, ${groupsCount} групп` +
        (groupConfigsWithColors > 0
          ? `, ${groupConfigsWithColors} групп с настройками цвета`
          : '')
    );
  }, []);

  // ───────────────────────────────────────────────────────────
  // IMPORT
  // ───────────────────────────────────────────────────────────
  const importToDataset = useCallback(
    async (file: File, targetDatasetId: string) => {
      try {
        // 1. Читаем файл
        const fileContent = await file.text();

        // 2. Собираем контекст для дедупликации
        const context = {
          targetDatasetId,
          existingMetricTemplates: useMetricTemplateStore.getState().templates,
          existingIndicatorGroups: useIndicatorGroupStore.getState().groups,
          existingDashboards: useDashboardStore.getState().dashboards,
        };

        // 3. Делегируем логику в чистый сервис
        const result = processConfigImport(fileContent, context);

        // 4. Применяем результат к сторам
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

        // 5. Инвалидируем кэш вычислений
        await invalidateComputationCache(targetDatasetId);

        // 6. Уведомляем и обновляем UI
        const { stats } = result;
        toast.success(
          `Конфиг применён: ${stats.dashboardsImported} дашбордов, ` +
            `${stats.groupsImported} групп, ${stats.hierarchyLevelsImported} уровней` +
            (stats.groupConfigsWithColors > 0
              ? `, ${stats.groupConfigsWithColors} групп с настройками цвета`
              : '')
        );
        router.refresh();
      } catch (error) {
        console.error('[ConfigImport] Error:', error);

        const message =
          error instanceof ConfigImportError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'Ошибка импорта';

        toast.error(message);
      }
    },
    [router]
  );

  return { exportDatasetConfig, importToDataset };
}

// ─────────────────────────────────────────────────────────────
// Вспомогательная функция — инвалидация кэша
// ─────────────────────────────────────────────────────────────
async function invalidateComputationCache(datasetId: string): Promise<void> {
  try {
    const fileCache = createComputationCache('file');
    await fileCache.clear(datasetId);
  } catch (err) {
    console.warn('[ConfigImport] File cache invalidation failed:', err);
  }
  try {
    const pgCache = createComputationCache('postgres');
    await pgCache.clear(datasetId);
  } catch (err) {
    console.warn('[ConfigImport] PG cache invalidation failed:', err);
  }
}