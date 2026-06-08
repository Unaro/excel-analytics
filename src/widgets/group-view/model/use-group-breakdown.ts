// widgets/group-view/model/use-group-breakdown.ts
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDatasetStore } from '@/entities/dataset';
import { HierarchyLevel, useHierarchyStore } from '@/entities/hierarchy';
import { useIndicatorGroupStore } from '@/entities/indicatorGroup';
import { DashboardComputationResult, GroupComputationResult, IndicatorGroup, useMetricTemplateStore } from '@/entities/metric';
import { useShallow } from 'zustand/react/shallow';
import { createComputeEngine } from '@/shared/lib/computation/lib/engine-factory';
import { CacheKey, createComputationCache } from '@/shared/lib/storage';
import { generateFiltersHash, generateConfigHash } from '@/shared/lib/utils/hash';
import { buildVmIdFromFields } from '@/shared/lib/utils/metric-ids';
import type { ClientComputeParams } from '@/shared/lib/computation/lib/types';
import { GroupMetric, HierarchyFilterValue, IndicatorGroupInDashboard, MetricTemplate, VirtualMetric } from '@/shared/lib/validators';
import { useColumnConfigStore } from '@/entities/columnConfig';
import { useGroupMetricConfigStore } from '@/entities/groupMetricConfig';
import type { ColumnConfig } from '@/entities/dataset';
import { useComputation } from '@/widgets/shared/model/use-computation';


const EMPTY_LEVELS: HierarchyLevel[] = [];
const EMPTY_CONFIGS: ColumnConfig[] = [];
const EMPTY_TEMPLATES: MetricTemplate[] = [];

export interface GroupBreakdownResult {
  group: IndicatorGroup | undefined;
  currentPath: HierarchyFilterValue[];
  nextLevel: HierarchyLevel | null;
  summary: GroupComputationResult | null;
  breakdown: GroupComputationResult['breakdown'] | undefined;
  virtualMetrics: VirtualMetric[];
  baseVirtualMetrics: VirtualMetric[];
  isComputing: boolean;
  error: string | null;
  drillDown: (label: string) => void;
  resetToLevel: (levelIndex: number) => void;
  resetAll: () => void;
}

/**
 * Фабрика: строит VirtualMetric из GroupMetric с sourceMetricId.
 */
function buildVirtualMetric(
  groupId: string,
  metric: GroupMetric,
  template: MetricTemplate | undefined,
  order: number
): VirtualMetric {
  const name =
    (metric.customName && `${metric.customName}(${template?.name})`) ||
    metric.customName ||
    template?.name ||
    'Metric';
  const displayFormat = template?.displayFormat || 'number';
  const decimalPlaces = template?.decimalPlaces || 2;
  const unit = template?.suffix || template?.prefix;

  return {
    id: buildVmIdFromFields(groupId, metric.id, name, displayFormat, decimalPlaces, unit),
    name,
    displayFormat,
    decimalPlaces,
    order: metric.order ?? order,
    unit,
    sourceMetricId: metric.id, // ✅ Связь с исходной GroupMetric
  };
}

export function useGroupBreakdown(
  groupId: string,
  initialPath: HierarchyFilterValue[] = []
): GroupBreakdownResult {
  const [currentPath, setCurrentPath] = useState<HierarchyFilterValue[]>(initialPath);

  const activeDatasetId = useDatasetStore(s => s.activeDatasetId);
  const sourceType = useDatasetStore(s => {
    const dataset = s.activeDatasetId ? s.datasets[s.activeDatasetId] : undefined;
    return dataset?.sourceType ?? 'file';
  });
  const encryptedConnection = useDatasetStore(s => {
    const dataset = s.activeDatasetId ? s.datasets[s.activeDatasetId] : undefined;
    return dataset?.pgConfig?.encryptedConnection;
  });
  const isSyncing = useDatasetStore(s => s.isSyncing);
  const group = useIndicatorGroupStore(s => s.getGroup(groupId));
  const templates = useMetricTemplateStore(useShallow(s => s.templates)) ?? EMPTY_TEMPLATES;
  const levels = useHierarchyStore(useShallow(s =>
    activeDatasetId ? s.getLevels(activeDatasetId) : EMPTY_LEVELS
  ));
  const columnConfigs = useColumnConfigStore(s =>
    activeDatasetId
      ? (s.configsByDataset[activeDatasetId] ?? EMPTY_CONFIGS)
      : EMPTY_CONFIGS
  );
  const validColumns = useMemo(() =>
    columnConfigs.filter(c => c.classification !== 'ignore').map(c => c.columnName),
    [columnConfigs]
  );
  const groupMetricConfigs = useGroupMetricConfigStore(
    (s) => s.configsByGroup[groupId]
  );

  const nextLevel = useMemo<HierarchyLevel | null>(() => {
    return levels[currentPath.length] ?? null;
  }, [levels, currentPath.length]);

  const virtualMetrics = useMemo<VirtualMetric[]>(() => {
    if (!group) return [];
    return group.metrics.map((m, idx) => {
      const tpl = templates.find(t => t.id === m.templateId);
      return buildVirtualMetric(group.id, m, tpl, idx);
    });
  }, [group, templates]);

  const virtualMetricsForUI = useMemo<VirtualMetric[]>(() => {
    if (!group) return [];
    return virtualMetrics.map((vm) => {
      const colorConfig = vm.sourceMetricId
        ? groupMetricConfigs?.[vm.sourceMetricId]?.colorConfig
        : undefined;
      return { ...vm, colorConfig };
    });
  }, [virtualMetrics, groupMetricConfigs]);

  const dashboardGroupsConfig = useMemo<IndicatorGroupInDashboard[]>(() => {
    if (!group) return [];
    return [{
      groupId: group.id,
      enabled: true,
      order: 0,
      virtualMetricBindings: group.metrics.map((m, idx) => {
        const tpl = templates.find(t => t.id === m.templateId);
        const vm = buildVirtualMetric(group.id, m, tpl, idx);
        return {
          virtualMetricId: vm.id,
          metricId: m.id,
        };
      }),
    }];
  }, [group, templates]);

  const filtersHash = useMemo(() => generateFiltersHash(currentPath), [currentPath]);
  const groupByColumn = nextLevel?.columnName;

  const configHash = useMemo(() => {
    return generateConfigHash({
      groups: group ? [group] : [],
      metricTemplates: templates,
      dashboardGroupsConfig,
      virtualMetrics,
    }) + (groupByColumn ? `:gb:${groupByColumn}` : '');
  }, [group, templates, dashboardGroupsConfig, virtualMetrics, groupByColumn]);

  const buildParams = useCallback((): ClientComputeParams | null => {
    if (!activeDatasetId || !group) return null;
    return {
      datasetId: activeDatasetId,
      dashboardId: `group:${groupId}`,
      tableName: 'placeholder',
      encryptedConfig: encryptedConnection,
      filters: currentPath,
      groups: [group],
      dashboardGroupsConfig,
      metricTemplates: templates,
      virtualMetrics,
      groupByColumn: groupByColumn ?? undefined,
      validColumns,
      pgSchema: useDatasetStore.getState().datasets[activeDatasetId]?.pgConfig?.schema,
      pgTable: useDatasetStore.getState().datasets[activeDatasetId]?.pgConfig?.table,
    };
  }, [
    activeDatasetId,
    group,
    groupId,
    encryptedConnection,
    currentPath,
    dashboardGroupsConfig,
    templates,
    virtualMetrics,
    groupByColumn,
    validColumns,
  ]);

  const buildCacheKey = useCallback((): CacheKey | null => {
    if (!activeDatasetId || !group) return null;
    return {
      datasetId: activeDatasetId,
      dashboardId: `group:${groupId}`,
      filtersHash: `${filtersHash}:${configHash}`,
    };
  }, [activeDatasetId, group, groupId, filtersHash, configHash]);

  const { result: computeResult, isComputing, error } = useComputation({
    activeDatasetId,
    sourceType,
    isSyncing,
    buildParams,
    buildCacheKey,
    deps: [filtersHash, configHash, currentPath, group?.id],
  });

  const summary = computeResult?.groups[0] ?? null;
  const breakdown = computeResult?.groups[0]?.breakdown;


  const drillDown = useCallback((label: string) => {
    if (!nextLevel) return;
    const newFilter: HierarchyFilterValue = {
      levelId: nextLevel.id,
      levelIndex: nextLevel.order,
      columnName: nextLevel.columnName,
      value: label,
      displayValue: label,
    };
    setCurrentPath(prev => [...prev, newFilter]);
  }, [nextLevel]);

  const resetToLevel = useCallback((levelIndex: number) => {
    setCurrentPath(prev => prev.slice(0, levelIndex));
  }, []);

  const resetAll = useCallback(() => {
    setCurrentPath([]);
  }, []);

  return {
    group,
    currentPath,
    nextLevel,
    summary,
    breakdown,
    virtualMetrics: virtualMetricsForUI,
    baseVirtualMetrics: virtualMetrics,
    isComputing,
    error,
    drillDown,
    resetToLevel,
    resetAll,
  };
}