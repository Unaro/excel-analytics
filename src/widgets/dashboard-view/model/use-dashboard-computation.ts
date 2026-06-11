'use client';

import { useCallback, useMemo } from 'react';
import { useIndicatorGroupStore } from '@/entities/indicator-group';
import { useMetricTemplateStore } from '@/entities/metric';
import { useDashboardStore } from '@/entities/dashboard';
import { useColumnConfigStore } from '@/entities/column-config';
import { useDatasetInfo } from '@/entities/group-view';
import { generateFiltersHash, generateConfigHash } from '@/shared/lib/utils/hash';
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
  const dashboardGroupsConfig = dashboard?.indicatorGroups ?? EMPTY_DASHBOARD_GROUPS;
  const virtualMetrics = dashboard?.virtualMetrics ?? EMPTY_VIRTUAL_METRICS;
  const groups = useIndicatorGroupStore(useShallow(s => s.groups)) ?? EMPTY_GROUPS;
  const metricTemplates = useMetricTemplateStore(useShallow(s => s.templates)) ?? EMPTY_TEMPLATES;

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

  const compositeHash = useMemo(
    () =>
      `${filtersHash}:${configHash}` +
      (isTimeMode ? `:dc:${dateColumn.columnName}:dg:${dateGranularity}` : ''),
    [filtersHash, configHash, isTimeMode, dateColumn, dateGranularity]
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
      pgSchema,
      pgTable,
    };
  }, [
    dashboard, activeDatasetId, dashboardId, encryptedConnection,
    hierarchyFilters, groups, dashboardGroupsConfig,
    metricTemplates, virtualMetrics, isTimeMode, dateColumn, dateGranularity,
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
  });

  // Запись результата в useComputedMetricsStore удалена вместе со стором:
  // у него не было ни одного читателя, а Map результатов рос без eviction
  // (п.2 аудита ядра). Результат живёт в state хука и в computation-cache.

  const mergedResult = useMemo<DashboardComputationResult | null>(() => {
    if (!result) return null;
    if (virtualMetrics.length === 0) return result;
    const updatedGroups = result.groups.map(group => ({
      ...group,
      virtualMetrics: group.virtualMetrics.map(vm => {
        const freshVm = virtualMetrics.find(f => f.id === vm.virtualMetricId);
        if (!freshVm) return vm;
        return { ...vm, virtualMetricName: freshVm.name };
      }),
      breakdown: group.breakdown?.map(item => ({
        ...item,
        virtualMetrics: item.virtualMetrics.map(vm => {
          const freshVm = virtualMetrics.find(f => f.id === vm.virtualMetricId);
          if (!freshVm) return vm;
          return { ...vm, virtualMetricName: freshVm.name };
        }),
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
  };
}