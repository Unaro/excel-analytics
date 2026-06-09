// shared/lib/services/config-import-service.ts
// ─────────────────────────────────────────────────────────────
// Чистая функция импорта конфигурации датасета.
//
// Принимает raw JSON, валидирует, дедуплицирует виртуальные метрики
// и возвращает структурированный результат для записи в сторы.
// ─────────────────────────────────────────────────────────────

import {
  DatasetConfigExportSchema,
  type HierarchyFilterValue,
  type IndicatorGroup,
  type IndicatorGroupInDashboard,
  type MetricTemplate,
  type VirtualMetric,
  type VirtualMetricBindingInDashboard,
} from '@/shared/lib/validators';
import { FormattingRule } from '../utils/fortmating-rules';
import type { Dashboard } from '@/entities/dashboard/model/types';

// ─────────────────────────────────────────────────────────────
// Публичные типы
// ─────────────────────────────────────────────────────────────

export interface ConfigImportContext {
  targetDatasetId: string;
  existingMetricTemplates: MetricTemplate[];
  existingIndicatorGroups: IndicatorGroup[];
  existingDashboards: Dashboard[];
  existingVmIds: Set<string>;
}

export interface ConfigImportResult {
  newMetricTemplates: MetricTemplate[];
  mergedIndicatorGroups: IndicatorGroup[];
  mergedDashboards: Dashboard[];
  hierarchyLevels: Array<{
    id: string;
    columnName: string;
    displayName: string;
    order: number;
  }>;
  columnConfigs: Array<{
    columnName: string;
    classification: 'numeric' | 'categorical' | 'ignore' | 'date';
    alias: string;
    displayName: string;
    description?: string;
  }>;
  importedGroupMetricConfigs?: Record<
    string,
    Record<
      string,
      {
        colorConfig?: {
          rules: FormattingRule[];
        };
      }
    >
  >;
  stats: {
    dashboardsImported: number;
    groupsImported: number;
    hierarchyLevelsImported: number;
    groupConfigsWithColors: number;
    vmIdConflicts: number;
  };
}

export class ConfigImportError extends Error {
  constructor(
    message: string,
    public readonly field?: string
  ) {
    super(message);
    this.name = 'ConfigImportError';
  }
}

// ─────────────────────────────────────────────────────────────
// Внутренние хелперы
// ─────────────────────────────────────────────────────────────

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new ConfigImportError('Файл не является валидным JSON');
  }
}

function validateConfigStructure(raw: unknown) {
  if (typeof raw !== 'object' || raw === null) {
    throw new ConfigImportError('Неверный формат файла: ожидается JSON-объект');
  }
  const parseResult = DatasetConfigExportSchema.safeParse(raw);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0];
    const path =
      firstIssue.path.length > 0
        ? ` в поле "${firstIssue.path.join('.')}"`
        : '';
    throw new ConfigImportError(
      `Невалидный формат конфига${path}: ${firstIssue.message}`,
      firstIssue.path.join('.')
    );
  }
  return parseResult.data;
}

function mergeWithExisting<T extends { datasetId?: string }>(
  existing: T[],
  imported: T[],
  targetDatasetId: string
): T[] {
  const otherData = existing.filter((d) => d.datasetId !== targetDatasetId);
  return [...otherData, ...imported];
}

interface RebuiltDashboard {
  dashboard: Dashboard;
  conflictCount: number;
}

/**
 * Перестраивает импортируемый дашборд:
 *   1. Сохраняет оригинальные VM ID из JSON, если они не конфликтуют
 *   2. Генерирует новые ID только при реальном конфликте
 *   3. Строит маппинг oldVmId → newVmId для обновления bindings
 *   4. Берёт colorConfig НАПРЯМУЮ из исходных VM (без матчинга)
 *   5. Сохраняет порядок VM как в исходном JSON
 */
function rebuildDashboard(
  rawDashboard: Record<string, unknown>,
  targetDatasetId: string,
  groupMap: Map<string, IndicatorGroup>,
  consumedVmIds: Set<string>
): RebuiltDashboard {
  const originalVms = (rawDashboard.virtualMetrics as VirtualMetric[]) || [];
  const dashboardGroupConfigs =
    (rawDashboard.indicatorGroups as IndicatorGroupInDashboard[]) || [];

  // ═══════════════════════════════════════════════════════════
  // ШАГ 1: Определяем итоговые ID для каждой VM
  // ═══════════════════════════════════════════════════════════
  const vmIdMapping = new Map<string, string>(); // oldId → newId
  let conflictCount = 0;
  const usedInThisDashboard = new Set<string>();

  for (const originalVm of originalVms) {
    const originalId = originalVm.id;
    const isConflict =
      consumedVmIds.has(originalId) || usedInThisDashboard.has(originalId);

    if (isConflict) {
      // Генерируем уникальный ID с суффиксом _imp_N
      let counter = 1;
      let candidate = `${originalId}_imp_${counter}`;
      while (
        consumedVmIds.has(candidate) ||
        usedInThisDashboard.has(candidate)
      ) {
        counter++;
        candidate = `${originalId}_imp_${counter}`;
      }
      vmIdMapping.set(originalId, candidate);
      usedInThisDashboard.add(candidate);
      conflictCount++;
    } else {
      // Сохраняем оригинальный ID
      vmIdMapping.set(originalId, originalId);
      usedInThisDashboard.add(originalId);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ШАГ 2: Перестраиваем virtualMetrics с сохранением порядка
  //         и colorConfig из исходного JSON
  // ═══════════════════════════════════════════════════════════
  const rebuiltVirtualMetrics: VirtualMetric[] = originalVms.map((originalVm) => {
    const newId = vmIdMapping.get(originalVm.id)!;
    return {
      ...originalVm,
      id: newId,
      colorConfig: originalVm.colorConfig,
      order: originalVm.order,
    };
  });

  // ═══════════════════════════════════════════════════════════
  // ШАГ 3: Обновляем virtualMetricBindings через маппинг
  // ═══════════════════════════════════════════════════════════
  const rebuiltGroupConfigs: IndicatorGroupInDashboard[] = [];

  for (const dgConfig of dashboardGroupConfigs) {
    const group = groupMap.get(dgConfig.groupId);
    if (!group) continue;

    const originalBindings = dgConfig.virtualMetricBindings || [];
    const newBindings: VirtualMetricBindingInDashboard[] = [];

    for (const binding of originalBindings) {
      // Маппим virtualMetricId через наш маппинг
      const newVmId = vmIdMapping.get(binding.virtualMetricId);
      if (!newVmId) {
        // VM не найдена в исходном списке — пропускаем
        continue;
      }

      // Проверяем, что metricId действительно существует в группе
      const metricExists = group.metrics.some((m) => m.id === binding.metricId);
      if (!metricExists) {
        // Метрика удалена из группы — пропускаем
        continue;
      }

      newBindings.push({
        virtualMetricId: newVmId,
        metricId: binding.metricId,
      });
    }

    rebuiltGroupConfigs.push({
      groupId: dgConfig.groupId,
      enabled: dgConfig.enabled,
      order: dgConfig.order,
      virtualMetricBindings: newBindings,
    });
  }

  const dashboard: Dashboard = {
    ...(rawDashboard as object),
    datasetId: targetDatasetId,
    virtualMetrics: rebuiltVirtualMetrics,
    indicatorGroups: rebuiltGroupConfigs,
    hierarchyFilters: [] as HierarchyFilterValue[],
  } as Dashboard;

  return { dashboard, conflictCount };
}

// ─────────────────────────────────────────────────────────────
// Публичная функция
// ─────────────────────────────────────────────────────────────

export function processConfigImport(
  fileContent: string,
  context: ConfigImportContext
): ConfigImportResult {
  const {
    targetDatasetId,
    existingMetricTemplates,
    existingIndicatorGroups,
    existingDashboards,
    existingVmIds,
  } = context;

  // 1. Парсинг и валидация
  const raw = safeParseJson(fileContent);
  const config = validateConfigStructure(raw);
  const { data } = config;

  // 2. Metric templates — добавляем только новые
  const existingTemplateIds = new Set(existingMetricTemplates.map((t) => t.id));
  const newMetricTemplates = (data.metricTemplates || []).filter(
    (t) => !existingTemplateIds.has(t.id)
  );

  // 3. Indicator groups — переназначаем datasetId
  const importedGroups: IndicatorGroup[] = (data.indicatorGroups || []).map((g) => ({
    ...g,
    datasetId: targetDatasetId,
  }));
  const mergedIndicatorGroups = mergeWithExisting(
    existingIndicatorGroups,
    importedGroups,
    targetDatasetId
  );

  // 4. GroupMap для быстрого доступа
  const groupMap = new Map<string, IndicatorGroup>(
    importedGroups.map((g) => [g.id, g])
  );

  // 5. ✅ Dashboards: rebuild с сохранением VM ID и colorConfig
  const rawDashboards = (data.dashboards || []) as Record<string, unknown>[];
  const importedDashboards: Dashboard[] = [];
  let totalVmConflicts = 0;

  // Mutable-копия existingVmIds — пополняется по мере обработки дашбордов,
  // чтобы детектить конфликты МЕЖДУ импортируемыми дашбордами
  const consumedVmIds = new Set(existingVmIds);

  for (const rawDashboard of rawDashboards) {
    const { dashboard, conflictCount } = rebuildDashboard(
      rawDashboard,
      targetDatasetId,
      groupMap,
      consumedVmIds
    );
    importedDashboards.push(dashboard);
    totalVmConflicts += conflictCount;

    // Регистрируем использованные VM ID для следующих дашбордов
    for (const vm of dashboard.virtualMetrics) {
      consumedVmIds.add(vm.id);
    }
  }

  const mergedDashboards = mergeWithExisting(
    existingDashboards,
    importedDashboards,
    targetDatasetId
  );

  // 6. Статистика
  const importedGroupConfigsCount = data.groupMetricConfigs
    ? Object.keys(data.groupMetricConfigs).length
    : 0;

  return {
    newMetricTemplates,
    mergedIndicatorGroups,
    mergedDashboards,
    hierarchyLevels: data.hierarchyLevels || [],
    columnConfigs: data.columnConfigs || [],
    importedGroupMetricConfigs: data.groupMetricConfigs,
    stats: {
      dashboardsImported: importedDashboards.length,
      groupsImported: importedGroups.length,
      hierarchyLevelsImported: data.hierarchyLevels?.length || 0,
      groupConfigsWithColors: importedGroupConfigsCount,
      vmIdConflicts: totalVmConflicts,
    },
  };
}