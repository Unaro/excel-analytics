'use client';

import { useCallback, useMemo } from 'react';
import { useIndicatorGroupStore } from '@/entities/indicator-group';
import { useMetricTemplateStore } from '@/entities/metric';
import { useDashboardStore } from '@/entities/dashboard';
import { useColumnConfigStore } from '@/entities/column-config';
import { useDatasetInfo } from '@/entities/group-view';
import { useAppSettingsStore, selectFormulaOptions } from '@/entities/app-settings';
import { generateFiltersHash, generateConfigHash } from '@/shared/lib/utils/hash';
import {
  resolveColumnTemplateId,
  buildEffectiveColumn,
  resolveDashboardGroupsConfig,
} from '@/shared/lib/utils/dashboard-columns';
import type { ClientComputeParams, DateGranularity } from '@/shared/lib/computation/lib/types';
import type { ColumnConfig } from '@/shared/lib/types';
import { useShallow } from 'zustand/react/shallow';
import type { MetricTemplate, DashboardComputationResult } from '@/entities/metric';
import type {
  HierarchyFilterValue,
  IndicatorGroup,
  IndicatorGroupInDashboard,
  VirtualMetric,
} from '@/shared/lib/validators';
import type { Dashboard } from '@/entities/dashboard';
import type { CacheKey } from '@/shared/lib/storage';
import { useComputation } from '@/shared/lib/computation/hooks/use-computation';

const EMPTY_FILTERS: HierarchyFilterValue[] = [];
const EMPTY_DASHBOARD_GROUPS: IndicatorGroupInDashboard[] = [];
const EMPTY_VIRTUAL_METRICS: VirtualMetric[] = [];
const EMPTY_GROUPS: IndicatorGroup[] = [];
const EMPTY_TEMPLATES: MetricTemplate[] = [];

const EMPTY_CONFIGS: ColumnConfig[] = [];

export interface DashboardComputationOptions {
  /**
   * Размерность временно́й группировки: каждая группа дашборда получает
   * breakdown по интервалам первой дата-колонки датасета (для секции
   * динамики). null — обычный режим (сводки без breakdown).
   */
  dateGranularity?: DateGranularity | null;
}

export function useDashboardComputation(
  dashboardId: string,
  options: DashboardComputationOptions = {}
) {
  const {
    activeDatasetId,
    sourceType,
    encryptedConnection,
    pgSchema,
    pgTable,
    isSyncing,
  } = useDatasetInfo();

  const columnConfigs = useColumnConfigStore(s =>
    activeDatasetId ? (s.configsByDataset[activeDatasetId] ?? EMPTY_CONFIGS) : EMPTY_CONFIGS
  );
  /** Первая колонка с классификацией «Дата» — для временно́го измерения. */
  const dateColumn = useMemo(
    () => columnConfigs.find(c => c.classification === 'date') ?? null,
    [columnConfigs]
  );
  const dateGranularity = options.dateGranularity ?? null;
  const isTimeMode = dateGranularity !== null && dateColumn !== null;

  const selectDashboard = useCallback(
    (s: { dashboards: Dashboard[] }) => s.dashboards.find(d => d.id === dashboardId),
    [dashboardId]
  );
  const dashboard = useDashboardStore(useShallow(selectDashboard));

  const hierarchyFilters = dashboard?.hierarchyFilters ?? EMPTY_FILTERS;
  const storedGroupsConfig = dashboard?.indicatorGroups ?? EMPTY_DASHBOARD_GROUPS;
  const storedColumns = dashboard?.virtualMetrics ?? EMPTY_VIRTUAL_METRICS;
  const groups = useIndicatorGroupStore(useShallow(s => s.groups)) ?? EMPTY_GROUPS;
  const metricTemplates = useMetricTemplateStore(useShallow(s => s.templates)) ?? EMPTY_TEMPLATES;

  // Колонка дашборда = шаблон. Здесь приводим хранимые колонки к виду,
  // понятному движку и таблице:
  //  - templateId выводим (ленивая миграция старых колонок без него);
  //  - формат/имя/единицу подставляем из шаблона (эффективная колонка);
  //  - привязки virtualMetricId→metricId материализуем авто по шаблону
  //    (+ override), движок получает прежний контракт.
  const columnsWithTemplate = useMemo(
    () =>
      storedColumns.map(c => ({
        ...c,
        templateId: resolveColumnTemplateId(c, storedGroupsConfig, groups),
      })),
    [storedColumns, storedGroupsConfig, groups]
  );

  const virtualMetrics = useMemo(
    () =>
      columnsWithTemplate.map(c =>
        buildEffectiveColumn(c, metricTemplates.find(t => t.id === c.templateId))
      ),
    [columnsWithTemplate, metricTemplates]
  );

  const dashboardGroupsConfig = useMemo(
    () => resolveDashboardGroupsConfig(columnsWithTemplate, storedGroupsConfig, groups),
    [columnsWithTemplate, storedGroupsConfig, groups]
  );

  const filtersHash = useMemo(
    () => generateFiltersHash(hierarchyFilters),
    [hierarchyFilters]
  );

  const configHash = useMemo(
    () =>
      generateConfigHash({
        groups,
        metricTemplates,
        dashboardGroupsConfig,
        virtualMetrics,
      }),
    [groups, metricTemplates, dashboardGroupsConfig, virtualMetrics]
  );

  // Настройки агрегатных формул влияют на компиляцию → в хеш и в params
  const formulaOptions = useAppSettingsStore(useShallow(selectFormulaOptions));  
  const formulaOptionsHash = `${formulaOptions.defaultAggregate}:${formulaOptions.requireExplicit}`;

  const compositeHash = useMemo(
    () =>
      `${filtersHash}:${configHash}:${formulaOptionsHash}` +
      (isTimeMode ? `:dc:${dateColumn.columnName}:dg:${dateGranularity}` : ''),
    [filtersHash, configHash, formulaOptionsHash, isTimeMode, dateColumn, dateGranularity]
  );

  const buildParams = useCallback((): ClientComputeParams | null => {
    if (!dashboard || !activeDatasetId) return null;
    return {
      datasetId: activeDatasetId,
      dashboardId,
      encryptedConfig: encryptedConnection,
      tableName: 'placeholder',
      filters: hierarchyFilters,
      groups,
      dashboardGroupsConfig,
      metricTemplates,
      virtualMetrics,
      groupByDateColumn: isTimeMode ? dateColumn.columnName : undefined,
      groupByDateGranularity: isTimeMode ? dateGranularity : undefined,
      formulaOptions,
      pgSchema,
      pgTable,
    };
  }, [
    dashboard, activeDatasetId, dashboardId, encryptedConnection,
    hierarchyFilters, groups, dashboardGroupsConfig,
    metricTemplates, virtualMetrics, isTimeMode, dateColumn, dateGranularity,
    formulaOptions,
    pgSchema, pgTable,
  ]);

  const buildCacheKey = useCallback((): CacheKey | null => {
    if (!activeDatasetId || !dashboard) return null;
    return {
      datasetId: activeDatasetId,
      dashboardId,
      filtersHash: compositeHash,
    };
  }, [activeDatasetId, dashboard, dashboardId, compositeHash]);

  const { result, isComputing, error, recalculate } = useComputation({
    activeDatasetId,
    sourceType,
    isSyncing,
    buildParams,
    buildCacheKey,
    deps: [compositeHash, dashboard?.id],
    label: 'dashboard',
  });

  // Запись результата в useComputedMetricsStore удалена вместе со стором:
  // у него не было ни одного читателя, а Map результатов рос без eviction
  // (п.2 аудита ядра). Результат живёт в state хука и в computation-cache.

  const mergedResult = useMemo<DashboardComputationResult | null>(() => {
    if (!result) return null;
    if (virtualMetrics.length === 0) return result;
    // id → актуальное имя: один проход вместо .find() на каждую ячейку
    // (иначе O(groups × строк × метрик × |virtualMetrics|)).
    const nameById = new Map(virtualMetrics.map(f => [f.id, f.name]));
    const withFreshName = <T extends { virtualMetricId: string; virtualMetricName?: string }>(vm: T): T => {
      const name = nameById.get(vm.virtualMetricId);
      return name === undefined ? vm : { ...vm, virtualMetricName: name };
    };
    const updatedGroups = result.groups.map(group => ({
      ...group,
      virtualMetrics: group.virtualMetrics.map(withFreshName),
      breakdown: group.breakdown?.map(item => ({
        ...item,
        virtualMetrics: item.virtualMetrics.map(withFreshName),
      })),
    }));
    return { ...result, virtualMetrics, groups: updatedGroups };
  }, [result, virtualMetrics]);

  return {
    result: mergedResult,
    isComputing,
    error,
    recalculate,
    dateColumn,
    /** Эффективные колонки (формат из шаблона) — для таблицы и flatten. */
    effectiveVirtualMetrics: virtualMetrics,
  };
}