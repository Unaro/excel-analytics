// shared/lib/services/config-export-service.ts
// ─────────────────────────────────────────────────────────────
// Чистая функция экспорта конфигурации датасета.
//
// НЕ импортирует Zustand-сторы — принимает данные через параметры.
// Это делает её:
//   1. Тестируемой без моков React
//   2. Переиспользуемой (server-actions, CLI, storybook)
//   3. Соответствующей FSD (shared не зависит от entities)
// ─────────────────────────────────────────────────────────────

import type { Dashboard } from '@/entities/dashboard/model/types';
import type { ColumnConfig } from '@/shared/lib/types/dataset';
import type {
  HierarchyFilterValue,
  IndicatorGroup,
  MetricTemplate,
} from '@/shared/lib/validators';
import type { GroupMetricConfig } from '@/entities/groupMetricConfig/model/store';
import type { HierarchyLevel } from '@/entities/hierarchy/model/types';

// ─────────────────────────────────────────────────────────────
// Публичные типы
// ─────────────────────────────────────────────────────────────

/**
 * Контекст экспорта: все данные, необходимые для построения payload.
 * Формируется вызывающим кодом (хуком в features/) из Zustand-сторов.
 */
export interface ConfigExportContext {
  datasetId: string;
  dashboards: Dashboard[];
  indicatorGroups: IndicatorGroup[];
  hierarchyLevels: HierarchyLevel[];
  columnConfigs: ColumnConfig[];
  metricTemplates: MetricTemplate[];
  groupMetricConfigs: Record<string, Record<string, GroupMetricConfig>>;
}

/**
 * Готовый payload для сохранения в JSON.
 */
export interface ConfigExportPayload {
  version: 2;
  exportType: 'dataset_config';
  exportedAt: number;
  sourceDatasetId: string;
  data: {
    dashboards: Dashboard[];
    indicatorGroups: IndicatorGroup[];
    hierarchyLevels: HierarchyLevel[];
    columnConfigs: ColumnConfig[];
    metricTemplates: MetricTemplate[];
    groupMetricConfigs?: Record<string, Record<string, GroupMetricConfig>>;
  };
}

/**
 * Результат экспорта: готовый Blob для скачивания + статистика.
 */
export interface ConfigExportResult {
  blob: Blob;
  suggestedFileName: string;
  stats: {
    dashboardsCount: number;
    groupsCount: number;
    groupConfigsWithColors: number;
  };
}

// ─────────────────────────────────────────────────────────────
// Внутренние хелперы
// ─────────────────────────────────────────────────────────────

/**
 * Фильтрует дашборды и группы, оставляя только принадлежащие датасету.
 * Сбрасывает hierarchyFilters — они runtime-значения, не часть конфига.
 */
function filterByDataset(
  dashboards: Dashboard[],
  groups: IndicatorGroup[],
  datasetId: string,
  activeDatasetId: string | null
): { dashboards: Dashboard[]; groups: IndicatorGroup[] } {
  const belongsToDataset = (entityDatasetId: string | undefined): boolean =>
    entityDatasetId === datasetId ||
    (!entityDatasetId && activeDatasetId === datasetId);

  const filteredDashboards = dashboards
    .filter((d) => belongsToDataset(d.datasetId))
    .map((d) => ({ ...d, hierarchyFilters: [] as HierarchyFilterValue[] }));

  const filteredGroups = groups.filter((g) => belongsToDataset(g.datasetId));

  return { dashboards: filteredDashboards, groups: filteredGroups };
}

/**
 * Отбирает только те groupMetricConfigs, которые относятся к группам датасета.
 * Игнорирует пустые записи (без реальных конфигов).
 */
function filterGroupMetricConfigs(
  allGroupConfigs: Record<string, Record<string, GroupMetricConfig>>,
  datasetGroupIds: Set<string>
): Record<string, Record<string, GroupMetricConfig>> {
  const result: Record<string, Record<string, GroupMetricConfig>> = {};

  for (const [groupId, metricConfigs] of Object.entries(allGroupConfigs)) {
    const belongsToDataset = datasetGroupIds.has(groupId);
    const hasConfigs = Object.keys(metricConfigs).length > 0;

    if (belongsToDataset && hasConfigs) {
      result[groupId] = metricConfigs;
    }
  }

  return result;
}

/**
 * Формирует детерминированное имя файла для экспорта.
 */
function buildFileName(datasetId: string): string {
  const dateStamp = new Date().toISOString().slice(0, 10);
  const idPrefix = datasetId.slice(0, 8);
  return `config-${idPrefix}-${dateStamp}.json`;
}

// ─────────────────────────────────────────────────────────────
// Публичная функция
// ─────────────────────────────────────────────────────────────

/**
 * Строит payload экспорта и готовый Blob для скачивания.
 *
 * @param context - данные из Zustand-сторов (передаёт вызывающий хук)
 * @param activeDatasetId - текущий активный датасет (для fallback-проверки принадлежности)
 * @returns Blob + suggestedFileName + stats для toast-уведомления
 */
export function buildConfigExportPayload(
  context: ConfigExportContext,
  activeDatasetId: string | null
): ConfigExportResult {
  const { datasetId } = context;

  // 1. Фильтруем данные по датасету
  const { dashboards, groups } = filterByDataset(
    context.dashboards,
    context.indicatorGroups,
    datasetId,
    activeDatasetId
  );

  // 2. Фильтруем groupMetricConfigs
  const datasetGroupIds = new Set(groups.map((g) => g.id));
  const groupMetricConfigs = filterGroupMetricConfigs(
    context.groupMetricConfigs,
    datasetGroupIds
  );

  // 3. Собираем итоговый payload
  const payload: ConfigExportPayload = {
    version: 2,
    exportType: 'dataset_config',
    exportedAt: Date.now(),
    sourceDatasetId: datasetId,
    data: {
      dashboards,
      indicatorGroups: groups,
      hierarchyLevels: context.hierarchyLevels,
      columnConfigs: context.columnConfigs,
      metricTemplates: context.metricTemplates,
      groupMetricConfigs:
        Object.keys(groupMetricConfigs).length > 0
          ? groupMetricConfigs
          : undefined,
    },
  };

  // 4. Сериализуем в Blob
  const jsonString = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });

  return {
    blob,
    suggestedFileName: buildFileName(datasetId),
    stats: {
      dashboardsCount: dashboards.length,
      groupsCount: groups.length,
      groupConfigsWithColors: Object.keys(groupMetricConfigs).length,
    },
  };
}