'use client';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useDatasetStore } from '@/entities/dataset';
import { useIndicatorGroupStore } from '@/entities/indicatorGroup';
import { useMetricTemplateStore } from '@/entities/metric';
import { useDashboardStore } from '@/entities/dashboard';
import { useComputedMetricsStore } from '@/entities/metric';
import { createComputationCache } from '@/lib/storage';
import { generateFiltersHash, generateConfigHash } from '@/shared/lib/utils/hash';
import { createComputeEngine } from '../lib/engine-factory';
import { ClientComputeParams } from '../lib/types';
import { useShallow } from 'zustand/react/shallow';

const EMPTY_FILTERS: [] = []
const EMPTY_DASHBOARD: [] = []
const EMPTY_METRICS: [] = []

export function useDashboardCalculation(dashboardId: string) {
  // ═══════════════════════════════════════════════════════════
  // 1. СЕЛЕКТОРЫ — подписываемся на все нужные сторы
  // ═══════════════════════════════════════════════════════════
  const activeDatasetId = useDatasetStore(s => s.activeDatasetId);
  const dataset = useDatasetStore(s => s.getActiveDataset());
  const sourceType = dataset?.sourceType ?? 'file';
  const isSyncing = useDatasetStore(s => s.isSyncing);

  const dashboard = useDashboardStore(
    useShallow(s => s.dashboards.find(d => d.id === dashboardId))
  );
  const hierarchyFilters = dashboard?.hierarchyFilters ?? EMPTY_FILTERS;
  const dashboardGroupsConfig = dashboard?.indicatorGroups ?? EMPTY_DASHBOARD;
  const virtualMetrics = dashboard?.virtualMetrics ?? EMPTY_METRICS;

  const groups = useIndicatorGroupStore(useShallow(s => s.groups));
  const metricTemplates = useMetricTemplateStore(useShallow(s => s.templates));

  const isComputing = useComputedMetricsStore(s => s.isComputing);
  const computationError = useComputedMetricsStore(s => s.computationError);
  const result = useComputedMetricsStore(s => s.dashboardResults.get(dashboardId));

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
    () => generateConfigHash({
      groups,
      metricTemplates,
      dashboardGroupsConfig,
      virtualMetrics,
    }),
    [groups, metricTemplates, dashboardGroupsConfig, virtualMetrics]
  );

  // Объединённый хеш для ключа кэша
  const compositeHash = `${filtersHash}:${configHash}`;

  // ═══════════════════════════════════════════════════════════
  // 4. ЯДРО ВЫЧИСЛЕНИЙ
  // ═══════════════════════════════════════════════════════════
  const performCalculation = useCallback(async (force = false) => {
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
      store.setComputingState(false, err instanceof Error ? err.message : 'Ошибка вычисления');
    }
  }, [
    dashboard, activeDatasetId, isSyncing, cache, engine,
    compositeHash, dashboardId, dataset?.pgConfig?.encryptedConnection,
    hierarchyFilters, groups, dashboardGroupsConfig, metricTemplates, virtualMetrics
  ]);

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