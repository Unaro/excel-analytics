'use client';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { DatasetState, useDatasetStore } from '@/entities/dataset';
import { useIndicatorGroupStore } from '@/entities/indicatorGroup';
import { useMetricTemplateStore } from '@/entities/metric';
import { useDashboardStore } from '@/entities/dashboard';
import { useComputedMetricsStore } from '@/entities/metric';
import { createComputationCache } from '@/lib/storage';
import { generateFiltersHash, generateConfigHash } from '@/shared/lib/utils/hash';
import { createComputeEngine } from '../lib/engine-factory';
import { ClientComputeParams } from '../lib/types';
import { useShallow } from 'zustand/react/shallow';

import type { Dashboard } from '@/entities/dashboard';
import type { MetricTemplate } from '@/entities/metric';
import type { DashboardComputationResult } from '@/entities/metric';
import type {
  HierarchyFilterValue,
  IndicatorGroup,
  IndicatorGroupInDashboard,
  VirtualMetric,
} from '@/shared/lib/validators';

// ═══════════════════════════════════════════════════════════
// СТАБИЛЬНЫЕ КОНСТАНТЫ (singleton-ссылки)
// Создаются ОДИН раз при загрузке модуля.
// ═══════════════════════════════════════════════════════════
const EMPTY_FILTERS: HierarchyFilterValue[] = [];
const EMPTY_DASHBOARD_GROUPS: IndicatorGroupInDashboard[] = [];
const EMPTY_VIRTUAL_METRICS: VirtualMetric[] = [];
const EMPTY_GROUPS: IndicatorGroup[] = [];
const EMPTY_TEMPLATES: MetricTemplate[] = [];

// ═══════════════════════════════════════════════════════════
// СТАБИЛЬНЫЕ СЕЛЕКТОРЫ (модульные константы)
// ═══════════════════════════════════════════════════════════

// --- Dataset Store ---
const selectActiveDatasetId = (s: DatasetState) => s.activeDatasetId;
const selectIsSyncing = (s: DatasetState) => s.isSyncing;
const selectActiveDataset = (s: DatasetState) =>
  s.activeDatasetId ? s.datasets[s.activeDatasetId] ?? null : null;

// --- Indicator Group Store ---
const selectGroups = (s: { groups: IndicatorGroup[] }) => s.groups;

// --- Metric Template Store ---
const selectTemplates = (s: { templates: MetricTemplate[] }) => s.templates;

// --- Computed Metrics Store ---
const selectIsComputing = (s: { isComputing: boolean }) => s.isComputing;
const selectComputationError = (s: { computationError: string | null }) =>
  s.computationError;

export function useDashboardCalculation(dashboardId: string) {
  // ═══════════════════════════════════════════════════════════
  // 1. СЕЛЕКТОРЫ
  // ═══════════════════════════════════════════════════════════
  const activeDatasetId = useDatasetStore(selectActiveDatasetId);
  const dataset = useDatasetStore(selectActiveDataset);
  const sourceType = dataset?.sourceType ?? 'file';
  const isSyncing = useDatasetStore(selectIsSyncing);

  // Dashboard: селектор зависит от dashboardId → useCallback
  const selectDashboard = useCallback(
    (s: { dashboards: Dashboard[] }) =>
      s.dashboards.find((d) => d.id === dashboardId),
    [dashboardId]
  );
  const dashboard = useDashboardStore(useShallow(selectDashboard));

  const hierarchyFilters = dashboard?.hierarchyFilters ?? EMPTY_FILTERS;
  const dashboardGroupsConfig =
    dashboard?.indicatorGroups ?? EMPTY_DASHBOARD_GROUPS;
  const virtualMetrics = dashboard?.virtualMetrics ?? EMPTY_VIRTUAL_METRICS;

  const groups =
    useIndicatorGroupStore(useShallow(selectGroups)) ?? EMPTY_GROUPS;
  const metricTemplates =
    useMetricTemplateStore(useShallow(selectTemplates)) ?? EMPTY_TEMPLATES;

  const isComputing = useComputedMetricsStore(selectIsComputing);
  const computationError = useComputedMetricsStore(selectComputationError);

  const selectResult = useCallback(
    (s: { dashboardResults: Map<string, DashboardComputationResult> }) =>
      s.dashboardResults.get(dashboardId) ?? null,
    [dashboardId]
  );
  const result = useComputedMetricsStore(selectResult);

  // ═══════════════════════════════════════════════════════════
  // 2. ИНФРАСТРУКТУРА: движок и кэш (стабильны до смены источника)
  // ═══════════════════════════════════════════════════════════
  const engine = useMemo(() => createComputeEngine(sourceType), [sourceType]);
  const cache = useMemo(() => createComputationCache(sourceType), [sourceType]);

  // ═══════════════════════════════════════════════════════════
  // 3. ДЕТЕКЦИЯ ИЗМЕНЕНИЙ: два независимых хеша
  // ═══════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════
  // 4. ЯДРО ВЫЧИСЛЕНИЙ
  // ═══════════════════════════════════════════════════════════
  const performCalculation = useCallback(
    async (force = false) => {
      if (!dashboard || !activeDatasetId || isSyncing) return;

      const store = useComputedMetricsStore.getState();
      const cacheKey = {
        datasetId: activeDatasetId,
        dashboardId,
        filtersHash: compositeHash,
      };

      if (!force) {
        const cached = await cache.get(cacheKey);
        if (cached) {
          store.setDashboardResult(dashboardId, cached.result);
          store.setComputingState(false, null);
          return;
        }
      }

      store.setComputingState(true, null);

      try {
        const params: ClientComputeParams = {
          datasetId: activeDatasetId,
          dashboardId,
          encryptedConfig: dataset?.pgConfig?.encryptedConnection,
          tableName: 'placeholder',
          filters: hierarchyFilters,
          groups,
          dashboardGroupsConfig,
          metricTemplates,
          virtualMetrics,
        };

        await engine.initialize(activeDatasetId);
        const calcResult = await engine.compute(params);

        store.setDashboardResult(dashboardId, calcResult);
        store.setComputingState(false, null);
        await cache.set(cacheKey, calcResult);
      } catch (err) {
        console.error('[DashboardCalculation] Error:', err);
        store.setComputingState(
          false,
          err instanceof Error ? err.message : 'Ошибка вычисления'
        );
      }
    },
    [
      dashboard,
      activeDatasetId,
      isSyncing,
      cache,
      engine,
      compositeHash,
      dashboardId,
      dataset?.pgConfig?.encryptedConnection,
      hierarchyFilters,
      groups,
      dashboardGroupsConfig,
      metricTemplates,
      virtualMetrics,
    ]
  );

  // ═══════════════════════════════════════════════════════════
  // 5. АВТО-ТРИГГЕР: реагирует на ЛЮБОЕ изменение конфигурации
  // ═══════════════════════════════════════════════════════════
  const lastHashRef = useRef<string | null>(null);

  useEffect(() => {
    if (!dashboard || isSyncing) return;
    if (lastHashRef.current !== compositeHash) {
      lastHashRef.current = compositeHash;
      performCalculation(false);
    }
  }, [compositeHash, dashboard?.id, isSyncing, performCalculation]);

  // ═══════════════════════════════════════════════════════════
  // 6. ПРИНУДИТЕЛЬНЫЙ ПЕРЕСЧЁТ (кнопка Refresh)
  // ═══════════════════════════════════════════════════════════
  const recalculate = useCallback(async () => {
    if (activeDatasetId) {
      await cache.clearByDashboard(activeDatasetId, dashboardId);
    }
    await performCalculation(true);
  }, [cache, activeDatasetId, dashboardId, performCalculation]);

  return { result, isComputing, error: computationError, recalculate };
}