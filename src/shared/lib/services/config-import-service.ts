// shared/lib/services/config-import-service.ts
// ─────────────────────────────────────────────────────────────
// Чистая функция импорта конфигурации датасета.
//
// Принимает raw JSON, валидирует, дедуплицирует виртуальные метрики
// и возвращает структурированный результат для записи в сторы.
// ─────────────────────────────────────────────────────────────

import {
  DatasetConfigExportSchema,
  type DatasetConfigExportParsed,
  type HierarchyFilterValue,
  type IndicatorGroup,
  type IndicatorGroupInDashboard,
  type MetricTemplate,
  type DashboardColumn,
  type VirtualMetricBindingInDashboard,
} from '@/shared/lib/validators';
import { FormattingRule } from '../utils/formatting-rules';
import type { Dashboard } from '@/shared/lib/types/dashboard';
import type { AggregateLayoutConfig } from '@/shared/lib/types/aggregate';

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
    customTypeId?: string;
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
  /** Разметка агрегата из конфига (применяется к целевому датасету). */
  aggregateConfig?: AggregateLayoutConfig;
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

/**
 * Нормализует конфиги, экспортированные до упразднения типа `aggregate`:
 * старый шаблон {type:'aggregate', aggregateFunction, aggregateField} без поля
 * `formula` превращается в формулу `FN(field)` — иначе строгая
 * MetricTemplateSchema (formula обязательна) отклонит весь импорт.
 * Зеркалит миграцию v2→v3 в template-store.
 */
function migrateLegacyConfig(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const root = raw as Record<string, unknown>;
  const data = root.data;
  if (typeof data !== 'object' || data === null) return raw;
  const templates = (data as Record<string, unknown>).metricTemplates;
  if (!Array.isArray(templates)) return raw;

  const migrated = templates.map((t) => {
    if (typeof t !== 'object' || t === null) return t;
    const tpl = t as Record<string, unknown>;
    if (tpl.formula != null) return t; // уже формульный — не трогаем
    const { type, aggregateFunction, aggregateField, ...rest } = tpl;
    if (type === 'aggregate' && aggregateFunction && aggregateField) {
      const fn = aggregateFunction === 'PERCENTILE' ? 'MEDIAN' : aggregateFunction;
      return { ...rest, formula: `${fn}(${aggregateField})` };
    }
    return t;
  });

  return { ...root, data: { ...(data as Record<string, unknown>), metricTemplates: migrated } };
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
  const originalVms = (rawDashboard.virtualMetrics as DashboardColumn[]) || [];
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
  const rebuiltVirtualMetrics: DashboardColumn[] = originalVms.map((originalVm) => {
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

/**
 * Импортирует JSON-конфигурацию датасета: валидация Zod-схемой,
 * дедупликация ID виртуальных метрик (суффикс _imp_N при конфликте),
 * мерж с существующими дашбордами/группами целевого датасета.
 *
 * @throws ConfigImportError при невалидном JSON или несоответствии схеме.
 */
/**
 * Парсит и валидирует JSON-конфиг (миграция legacy + Zod-схема), не применяя его.
 * Используется мастером «готовая конфигурация» для предпросмотра/сверки с файлом
 * до импорта. @throws ConfigImportError при невалидном JSON/схеме.
 */
export function parseConfigFile(fileContent: string): DatasetConfigExportParsed {
  const raw = migrateLegacyConfig(safeParseJson(fileContent));
  return validateConfigStructure(raw);
}

export function processConfigImport(
  fileContent: string,
  context: ConfigImportContext
): ConfigImportResult {
  // 1. Парсинг и валидация → применение распарсенного конфига.
  return processParsedConfigImport(parseConfigFile(fileContent), context);
}

/**
 * Применяет УЖЕ распарсенный и провалидированный конфиг (без чтения файла):
 * дедупликация VM ID, мерж с группами/дашбордами целевого датасета. Ядро
 * `processConfigImport`; используется также при импорте «готовой конфигурации»
 * в мастере, где конфиг уже разобран и отфильтрован по выбору пользователя.
 */
export function processParsedConfigImport(
  config: DatasetConfigExportParsed,
  context: ConfigImportContext
): ConfigImportResult {
  const {
    targetDatasetId,
    existingMetricTemplates,
    existingIndicatorGroups,
    existingDashboards,
    existingVmIds,
  } = context;

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
    aggregateConfig: data.aggregateConfig,
    stats: {
      dashboardsImported: importedDashboards.length,
      groupsImported: importedGroups.length,
      hierarchyLevelsImported: data.hierarchyLevels?.length || 0,
      groupConfigsWithColors: importedGroupConfigsCount,
      vmIdConflicts: totalVmConflicts,
    },
  };
}