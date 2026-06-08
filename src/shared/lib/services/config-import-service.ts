// shared/lib/services/config-import-service.ts
// ─────────────────────────────────────────────────────────────
// Чистая функция импорта конфигурации датасета.
//
// Принимает raw JSON, валидирует, дедуплицирует виртуальные метрики
// и возвращает структурированный результат для записи в сторы.
//
// НЕ импортирует Zustand-сторы — вызывающий хук применяет результат.
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
import { buildDeterministicVmId } from '@/shared/lib/utils/metric-ids';
import type { Dashboard } from '@/entities/dashboard/model/types';
import { FormattingRule } from '../utils/fortmating-rules';

// ─────────────────────────────────────────────────────────────
// Публичные типы
// ─────────────────────────────────────────────────────────────

/**
 * Контекст для применения результата импорта.
 * Содержит списки уже существующих сущностей для дедупликации.
 */
export interface ConfigImportContext {
  targetDatasetId: string;
  existingMetricTemplates: MetricTemplate[];
  existingIndicatorGroups: IndicatorGroup[];
  existingDashboards: Dashboard[];
}

/**
 * Результат импорта: готовые данные для записи в сторы + статистика.
 */
export interface ConfigImportResult {
  // Новые шаблоны (уже отфильтрованы от существующих)
  newMetricTemplates: MetricTemplate[];

  // Полные списки для замены в сторах (с сохранением данных других датасетов)
  mergedIndicatorGroups: IndicatorGroup[];
  mergedDashboards: Dashboard[];

  // Данные для прямой записи
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

  // Статистика для toast
  stats: {
    dashboardsImported: number;
    groupsImported: number;
    hierarchyLevelsImported: number;
    groupConfigsWithColors: number;
  };
}

/**
 * Ошибка валидации импортируемого конфига.
 */
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

/**
 * Безопасно парсит JSON-строку.
 */
function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new ConfigImportError('Файл не является валидным JSON');
  }
}

/**
 * Валидирует структуру через Zod-схему.
 */
function validateConfigStructure(raw: unknown) {
  if (typeof raw !== 'object' || raw === null) {
    throw new ConfigImportError(
      'Неверный формат файла: ожидается JSON-объект'
    );
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

/**
 * Дедуплицирует виртуальные метрики по семантическому ключу.
 *
 * В старых конфигах виртуальные метрики могли иметь разные ID
 * при одинаковых name/format/decimals/unit. Это приводило к дублям
 * в UI. Здесь мы строим детерминированный ID на основе семантики.
 */
function rebuildVirtualMetrics(
  importedGroupConfigs: IndicatorGroupInDashboard[],
  groupMap: Map<string, IndicatorGroup>,
  allTemplates: MetricTemplate[],
  originalVirtualMetrics: VirtualMetric[]
): {
  rebuiltVirtualMetrics: VirtualMetric[];
  rebuiltGroupConfigs: IndicatorGroupInDashboard[];
} {
  const vmByKey = new Map<string, VirtualMetric>();
  const rebuiltGroupConfigs: IndicatorGroupInDashboard[] = [];

  for (const dgConfig of importedGroupConfigs) {
    const group = groupMap.get(dgConfig.groupId);
    if (!group) continue;

    const newBindings: VirtualMetricBindingInDashboard[] = [];

    for (const metric of group.metrics) {
      if (!metric.enabled) continue;

      const template = allTemplates.find((t) => t.id === metric.templateId);
      const name =
        (metric.customName &&
          `${metric.customName}(${template?.name})`) ||
        metric.customName ||
        template?.name ||
        'Metric';
      const displayFormat =
        metric.customDisplayFormat || template?.displayFormat || 'number';
      const decimalPlaces =
        metric.customDecimalPlaces ?? template?.decimalPlaces ?? 2;
      const unit = metric.unit || template?.suffix || template?.prefix;

      const semanticKey = `${name}::${displayFormat}::${decimalPlaces}::${unit ?? ''}`;

      if (!vmByKey.has(semanticKey)) {
        const originalVm = originalVirtualMetrics.find(
          (vm) =>
            vm.name === name &&
            vm.displayFormat === displayFormat &&
            vm.decimalPlaces === decimalPlaces &&
            vm.unit === unit
        );

        vmByKey.set(semanticKey, {
          id: buildDeterministicVmId(semanticKey),
          name,
          displayFormat,
          decimalPlaces,
          order: vmByKey.size,
          unit,
          colorConfig:
            originalVm?.colorConfig ||
            originalVirtualMetrics.find((vm) => vm.id === metric.id)
              ?.colorConfig,
        });
      }

      const vm = vmByKey.get(semanticKey)!;
      newBindings.push({
        virtualMetricId: vm.id,
        metricId: metric.id,
      });
    }

    rebuiltGroupConfigs.push({
      groupId: dgConfig.groupId,
      enabled: dgConfig.enabled,
      order: dgConfig.order,
      virtualMetricBindings: newBindings,
    });
  }

  return {
    rebuiltVirtualMetrics: Array.from(vmByKey.values()),
    rebuiltGroupConfigs,
  };
}

/**
 * Применяет импортированные данные к существующим, сохраняя
 * данные других датасетов.
 */
function mergeWithExisting<T extends { datasetId?: string }>(
  existing: T[],
  imported: T[],
  targetDatasetId: string
): T[] {
  const otherData = existing.filter((d) => d.datasetId !== targetDatasetId);
  return [...otherData, ...imported];
}

// ─────────────────────────────────────────────────────────────
// Публичная функция
// ─────────────────────────────────────────────────────────────

/**
 * Парсит, валидирует и подготавливает данные импорта.
 *
 * @param fileContent - содержимое JSON-файла (строка)
 * @param context - текущее состояние сторов для дедупликации
 * @returns структурированный результат для применения в сторах
 * @throws ConfigImportError при проблемах с файлом или валидацией
 */
export function processConfigImport(
  fileContent: string,
  context: ConfigImportContext
): ConfigImportResult {
  const { targetDatasetId, existingMetricTemplates, existingIndicatorGroups, existingDashboards } = context;

  // 1. Парсинг и валидация
  const raw = safeParseJson(fileContent);
  const config = validateConfigStructure(raw);
  const { data } = config;

  // 2. Metric templates — добавляем только новые
  const existingTemplateIds = new Set(existingMetricTemplates.map((t) => t.id));
  const newMetricTemplates = (data.metricTemplates || []).filter(
    (t) => !existingTemplateIds.has(t.id)
  );
  const allTemplates = [...existingMetricTemplates, ...newMetricTemplates];

  // 3. Indicator groups — переназначаем datasetId
  const importedGroups: IndicatorGroup[] = (data.indicatorGroups || []).map(
    (g) => ({
      ...g,
      datasetId: targetDatasetId,
    })
  );
  const mergedIndicatorGroups = mergeWithExisting(
    existingIndicatorGroups,
    importedGroups,
    targetDatasetId
  );

  // 4. Группируем импортированные группы в Map для быстрого доступа
  const groupMap = new Map<string, IndicatorGroup>(
    importedGroups.map((g) => [g.id, g])
  );

  // 5. Dashboards — с дедупликацией виртуальных метрик
  const importedDashboards = (data.dashboards || []).map((d) => {
    const dash = d as Record<string, unknown>;
    const dashboardGroupConfigs =
      (dash.indicatorGroups as IndicatorGroupInDashboard[]) || [];

    const { rebuiltVirtualMetrics, rebuiltGroupConfigs } =
      rebuildVirtualMetrics(
        dashboardGroupConfigs,
        groupMap,
        allTemplates,
        (dash.virtualMetrics as VirtualMetric[]) || []
      );

    return {
      ...(dash as object),
      datasetId: targetDatasetId,
      virtualMetrics: rebuiltVirtualMetrics,
      indicatorGroups: rebuiltGroupConfigs,
      hierarchyFilters: [] as HierarchyFilterValue[],
    } as Dashboard;
  });

  const mergedDashboards = mergeWithExisting(
    existingDashboards,
    importedDashboards,
    targetDatasetId
  );

  // 6. Статистика для toast
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
    },
  };
}