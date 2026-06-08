'use client';

import { useCallback, useMemo } from 'react';
import { useDatasetStore } from '@/entities/dataset';
import { useIndicatorGroupStore } from '@/entities/indicatorGroup';
import { useMetricTemplateStore } from '@/entities/metric';
import { useDashboardStore } from '@/entities/dashboard';
import { useComputedMetricsStore } from '@/entities/metric';
import { generateFiltersHash, generateConfigHash } from '@/shared/lib/utils/hash';
import type { ClientComputeParams } from '@/shared/lib/computation/lib/types';
import { useShallow } from 'zustand/react/shallow';
import type { MetricTemplate } from '@/entities/metric';
import type { DashboardComputationResult } from '@/entities/metric';
import type {
  HierarchyFilterValue,
  IndicatorGroup,
  IndicatorGroupInDashboard,
  VirtualMetric,
} from '@/shared/lib/validators';
import type { Dashboard } from '@/entities/dashboard';
import type { CacheKey } from '@/shared/lib/storage';
import { useComputation } from '@/widgets/shared/model/use-computation';

const EMPTY_FILTERS: HierarchyFilterValue[] = [];
const EMPTY_DASHBOARD_GROUPS: IndicatorGroupInDashboard[] = [];
const EMPTY_VIRTUAL_METRICS: VirtualMetric[] = [];
const EMPTY_GROUPS: IndicatorGroup[] = [];
const EMPTY_TEMPLATES: MetricTemplate[] = [];

export function useDashboardComputation(dashboardId: string) {
  const activeDatasetId = useDatasetStore(s => s.activeDatasetId);
  const dataset = useDatasetStore(s =>
    s.activeDatasetId ? s.datasets[s.activeDatasetId] ?? null : null
  );
  const sourceType = dataset?.sourceType ?? 'file';
  const isSyncing = useDatasetStore(s => s.isSyncing);

  const selectDashboard = useCallback(
    (s: { dashboards: Dashboard[] }) => s.dashboards.find(d => d.id === dashboardId),
    [dashboardId]
  );
  const dashboard = useDashboardStore(useShallow(selectDashboard));

  const hierarchyFilters = dashboard?.hierarchyFilters ?? EMPTY_FILTERS;
  const dashboardGroupsConfig = dashboard?.indicatorGroups ?? EMPTY_DASHBOARD_GROUPS;
  const virtualMetrics = dashboard?.virtualMetrics ?? EMPTY_VIRTUAL_METRICS;

  const groups = useIndicatorGroupStore(useShallow(s => s.groups)) ?? EMPTY_GROUPS;
  const metricTemplates =
    useMetricTemplateStore(useShallow(s => s.templates)) ?? EMPTY_TEMPLATES;

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
  const compositeHash = `${filtersHash}:${configHash}`;

  // ✅ Функция построения params
  const buildParams = useCallback((): ClientComputeParams | null => {
    if (!dashboard || !activeDatasetId) return null;
    return {
      datasetId: activeDatasetId,
      dashboardId,
      encryptedConfig: dataset?.pgConfig?.encryptedConnection,
      tableName: 'placeholder',
      filters: hierarchyFilters,
      groups,
      dashboardGroupsConfig,
      metricTemplates,
      virtualMetrics,
      pgSchema: dataset?.pgConfig?.schema,
      pgTable: dataset?.pgConfig?.table,
    };
  }, [
    dashboard,
    activeDatasetId,
    dashboardId,
    dataset?.pgConfig,
    hierarchyFilters,
    groups,
    dashboardGroupsConfig,
    metricTemplates,
    virtualMetrics,
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

  const storeSetResult = useComputedMetricsStore(s => s.setDashboardResult);
  const storeSetComputing = useComputedMetricsStore(s => s.setComputingState);

  useMemo(() => {
    if (result) storeSetResult(dashboardId, result);
  }, [result, dashboardId, storeSetResult]);

  useMemo(() => {
    storeSetComputing(isComputing, error);
  }, [isComputing, error, storeSetComputing]);

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
  };
}