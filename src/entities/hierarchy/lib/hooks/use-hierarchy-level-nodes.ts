'use client';
import { logger } from '@/shared/lib/logger';
import { useEffect, useState, useMemo } from 'react';
import { useDatasetStore } from '@/entities/dataset';
import { useColumnDictionary } from '@/entities/reference-type';
import { createComputeEngine } from '@/shared/lib/computation/lib/engine-factory';
import { createComputationCache } from '@/shared/lib/storage'; // ← ОБНОВЛЁННЫЙ ИМПОРТ
import { generateFiltersHash } from '@/shared/lib/utils/hash';
import type { ClientComputeParams } from '@/shared/lib/computation/lib/types';
import { HierarchyFilterValue, IndicatorGroup, IndicatorGroupInDashboard, MetricTemplate, GroupMetric, VirtualMetric } from '@/shared/lib/validators';
import { HierarchyNode, HierarchyLevel } from '@/entities/hierarchy/model/types';
import { useColumnConfigStore } from '@/entities/column-config';
import { ColumnConfig } from '@/shared/lib/types';

const EMPTY_CONFIGS: ColumnConfig[] = [];
const TPL_ID = '__hierarchy_count_tpl__';
const METRIC_ID = '__hierarchy_count_m__';
const GROUP_ID = '__hierarchy_group__';
const VM_ID = '__hierarchy_vm__';

function buildDummyParams(columnName: string): {
  groups: IndicatorGroup[];
  dashboardGroupsConfig: IndicatorGroupInDashboard[];
  metricTemplates: MetricTemplate[];
  virtualMetrics: VirtualMetric[];
} {
  const template: MetricTemplate = {
    id: TPL_ID,
    name: 'Count',
    formula: 'COUNT(val)',
    dependencies: [{ type: 'field', alias: 'val' }],
    displayFormat: 'number',
    decimalPlaces: 0,
    createdAt: 0,
    updatedAt: 0,
  };

  const metric: GroupMetric = {
    id: METRIC_ID,
    templateId: TPL_ID,
    fieldBindings: [{ id: 'fb1', fieldAlias: 'val', columnName }],
    metricBindings: [],
    enabled: true,
    order: 0,
  };

  const group: IndicatorGroup = {
    id: GROUP_ID,
    name: 'Hierarchy',
    fieldMappings: [],
    metrics: [metric],
    order: 0,
    createdAt: 0,
    updatedAt: 0,
  };

  const dashboardGroupsConfig: IndicatorGroupInDashboard[] = [{
    groupId: GROUP_ID,
    enabled: true,
    order: 0,
    virtualMetricBindings: [{ virtualMetricId: VM_ID, metricId: METRIC_ID }],
  }];

  const virtualMetrics: VirtualMetric[] = [{
    id: VM_ID,
    name: 'Count',
    displayFormat: 'number',
    decimalPlaces: 0,
    order: 0,
  }];

  return { groups: [group], dashboardGroupsConfig, metricTemplates: [template], virtualMetrics };
}

export function useHierarchyLevelNodes(
  level: HierarchyLevel | null,
  parentPath: HierarchyFilterValue[],
  hasNextLevel: boolean
) {
  const activeDatasetId = useDatasetStore(s => s.activeDatasetId);
  const dataset = useDatasetStore(s => s.getActiveDataset());
  const sourceType = dataset?.sourceType ?? 'file';
  const isSyncing = useDatasetStore(s => s.isSyncing);

  const totalRows = dataset?.metadata?.totalRows ?? 0;

  const [nodes, setNodes] = useState<HierarchyNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const engine = useMemo(() => createComputeEngine(sourceType), [sourceType]);
  const cache = useMemo(() => createComputationCache(sourceType), [sourceType]);

  const columnConfigs = useColumnConfigStore(s =>
    activeDatasetId ? (s.configsByDataset[activeDatasetId] ?? EMPTY_CONFIGS) : EMPTY_CONFIGS
  );

  const validColumns = useMemo(() =>
    columnConfigs.filter(c => c.classification !== 'ignore').map(c => c.columnName),
    [columnConfigs]
  );

  const filtersHash = useMemo(() => generateFiltersHash(parentPath), [parentPath]);
  const columnName = level?.columnName ?? '';

  useEffect(() => {
    if (!activeDatasetId || !level || isSyncing) {
      setNodes([]);
      return;
    }

    let cancelled = false;
    // AbortController вместо одного лишь cancelled-флага: сигнал доходит
    // до engine.compute → manager → CANCEL в воркер, и брошенные при быстром
    // drill-down вычисления не дорабатывают зря (п.10 аудита ядра).
    const controller = new AbortController();
    setIsLoading(true);

    // Профиль задержки: уровни иерархии считаются БЕЗ debounce и занимают
    // единственный воркер раньше таблицы дашборда (см. ROADMAP «лаг фильтра»).
    const tStart = performance.now();
    const logLatency = (kind: 'cache' | 'worker') =>
      logger.info(
        `[HierarchyNodes] ⏱️ ${columnName} → ${kind} ` +
          `${Math.round(performance.now() - tStart)}ms`
      );

    const compute = async () => {
      const { groups, dashboardGroupsConfig, metricTemplates, virtualMetrics } = buildDummyParams(columnName);

      const cacheKey = {
        datasetId: activeDatasetId,
        dashboardId: `hierarchy:${columnName}`,
        filtersHash: `${filtersHash}:hierarchy`,
      };

      // Ошибка кэша не должна ронять эффект без setIsLoading(false) —
      // при сбое просто считаем заново.
      let cached: Awaited<ReturnType<typeof cache.get>> = null;
      try {
        cached = await cache.get(cacheKey);
      } catch (err) {
        logger.warn('[HierarchyNodes] Cache read failed, recomputing:', err);
      }
      if (cached && !cancelled) {
        const res = cached.result;
        const breakdown = res.groups[0]?.breakdown ?? [];
        const mapped = breakdown.map(item => ({
          value: item.label,
          displayValue: item.label,
          level: level,
          childCount: hasNextLevel ? 1 : 0,
          recordCount: item.recordCount,
          isExpanded: false,
          isSelected: false,
        })).sort((a, b) => a.displayValue.localeCompare(b.displayValue, undefined, { numeric: true }));
        setNodes(mapped);
        setIsLoading(false);
        logLatency('cache');
        return;
      }

      try {
        const params: ClientComputeParams = {
          datasetId: activeDatasetId,
          dashboardId: `hierarchy:${columnName}`,
          tableName: 'placeholder',
          encryptedConfig: dataset?.pgConfig?.encryptedConnection,
          filters: parentPath,
          groups,
          dashboardGroupsConfig,
          metricTemplates,
          virtualMetrics,
          groupByColumn: columnName,
          validColumns,
          pgSchema: dataset?.pgConfig?.schema,
          pgTable: dataset?.pgConfig?.table,
        };

        await engine.initialize(activeDatasetId);
        const result = await engine.compute(params, controller.signal);

        if (cancelled) return;

        await cache.set(cacheKey, result);

        const breakdown = result.groups[0]?.breakdown ?? [];
        const mapped = breakdown.map(item => ({
          value: item.label,
          displayValue: item.label,
          level: level,
          childCount: hasNextLevel ? 1 : 0,
          recordCount: item.recordCount,
          isExpanded: false,
          isSelected: false,
        })).sort((a, b) => a.displayValue.localeCompare(b.displayValue, undefined, { numeric: true }));

        setNodes(mapped);
        logLatency('worker');
      } catch (err) {
        // Отмена — штатный исход при размонтировании/смене уровня
        if (err instanceof DOMException && err.name === 'AbortError') return;
        logger.error('[HierarchyNodes] Compute failed:', err);
        if (!cancelled) setNodes([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    compute();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeDatasetId, level, columnName, isSyncing, filtersHash, engine, cache, dataset, hasNextLevel, validColumns, totalRows,]);

  // Подстановка справочника (код → наименование) поверх готовых узлов:
  // value остаётся кодом (уходит в фильтры), displayValue — имя для UI.
  // Применяется в memo, а не в effect вычисления — загрузка словаря
  // не перезапускает compute.
  const { resolve, hasDictionary } = useColumnDictionary(activeDatasetId, columnName);
  const displayNodes = useMemo(() => {
    if (!hasDictionary) return nodes;
    return nodes
      .map(n => ({ ...n, displayValue: resolve(n.value) }))
      .sort((a, b) =>
        a.displayValue.localeCompare(b.displayValue, undefined, { numeric: true })
      );
  }, [nodes, resolve, hasDictionary]);

  return { nodes: displayNodes, isLoading };
}