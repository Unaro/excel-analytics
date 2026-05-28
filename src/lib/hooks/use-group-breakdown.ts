'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDatasetStore } from '@/entities/dataset';
import { HierarchyLevel, useHierarchyStore } from '@/entities/hierarchy';
import { useIndicatorGroupStore } from '@/entities/indicatorGroup';
import { DashboardComputationResult, GroupComputationResult, IndicatorGroup, useMetricTemplateStore } from '@/entities/metric';
import { useShallow } from 'zustand/react/shallow';
import { createComputeEngine } from '@/features/computation/lib/engine-factory';
import { createComputationCache } from '@/lib/storage';
import { generateFiltersHash, generateConfigHash } from '@/shared/lib/utils/hash';
import { buildVmIdFromFields } from '@/shared/lib/utils/metric-ids';
import type { ClientComputeParams } from '@/features/computation/lib/types';
import { HierarchyFilterValue, IndicatorGroupInDashboard, VirtualMetric } from '@/shared/lib/validators';

export interface GroupBreakdownResult {
  group: IndicatorGroup | undefined;
  /** Текущий путь от корня до выбранного узла */
  currentPath: HierarchyFilterValue[];
  /** Следующий уровень иерархии (null если достигли листа) */
  nextLevel: HierarchyLevel | null;
  /** Сводные значения по всей выборке (для KPI карточек сверху) */
  summary: GroupComputationResult | null;
  /** Разбивка по дочерним элементам текущего уровня */
  breakdown: GroupComputationResult['breakdown'] | undefined;
  /** Виртуальные метрики группы */
  virtualMetrics: VirtualMetric[];
  isComputing: boolean;
  error: string | null;
  /** Перейти на уровень ниже (добавить следующий фильтр) */
  drillDown: (label: string) => void;
  /** Вернуться к определённому уровню (обрезать путь) */
  resetToLevel: (levelIndex: number) => void;
  /** Полный сброс */
  resetAll: () => void;
}

/**
 * Хук для страницы группы показателей с поддержкой drill-down по иерархии.
 */
export function useGroupBreakdown(
  groupId: string,
  initialPath: HierarchyFilterValue[] = []
): GroupBreakdownResult {
  // ─────────────────────────────────────────────────────────────
  // 1. СОСТОЯНИЕ ПУТИ
  // ─────────────────────────────────────────────────────────────
  const [currentPath, setCurrentPath] = useState<HierarchyFilterValue[]>(initialPath);

  // ─────────────────────────────────────────────────────────────
  // 2. СЕЛЕКТОРЫ СТОРОВ
  // ─────────────────────────────────────────────────────────────
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
  const templates = useMetricTemplateStore(useShallow(s => s.templates));
  const levels = useHierarchyStore(useShallow(s =>
    activeDatasetId ? s.getLevels(activeDatasetId) : []
  ));

  // ─────────────────────────────────────────────────────────────
  // 3. СЛЕДУЮЩИЙ УРОВЕНЬ И ВИРТУАЛЬНЫЕ МЕТРИКИ
  // ─────────────────────────────────────────────────────────────
  const nextLevel = useMemo<HierarchyLevel | null>(() => {
    return levels[currentPath.length] ?? null;
  }, [levels, currentPath.length]);

  const virtualMetrics = useMemo<VirtualMetric[]>(() => {
    if (!group) return [];
    return group.metrics.map((m, idx) => {
      const tpl = templates.find(t => t.id === m.templateId);
      const name = m.customName && `${m.customName}(${tpl?.name})` || m.customName || tpl?.name || 'Metric';
      const displayFormat = tpl?.displayFormat || 'number';
      const decimalPlaces = tpl?.decimalPlaces || 2;
      const unit = tpl?.suffix || tpl?.prefix;
      return {
        id: buildVmIdFromFields(name, displayFormat, decimalPlaces, unit),
        name,
        displayFormat,
        decimalPlaces,
        order: m.order ?? idx,
        unit,
      };
    });
  }, [group, templates]);

  const dashboardGroupsConfig = useMemo<IndicatorGroupInDashboard[]>(() => {
    if (!group) return [];
    return [{
      groupId: group.id,
      enabled: true,
      order: 0,
      virtualMetricBindings: group.metrics.map(m => {
        const tpl = templates.find(t => t.id === m.templateId);
        const name = m.customName || tpl?.name || 'Metric';
        const displayFormat = tpl?.displayFormat || 'number';
        const decimalPlaces = tpl?.decimalPlaces || 2;
        const unit = tpl?.suffix || tpl?.prefix;
        return {
          virtualMetricId: buildVmIdFromFields(name, displayFormat, decimalPlaces, unit),
          metricId: m.id,
        };
      }),
    }];
  }, [group, templates]);

  // ─────────────────────────────────────────────────────────────
  // 4. СОСТОЯНИЕ ВЫЧИСЛЕНИЙ
  // ─────────────────────────────────────────────────────────────
  const [summary, setSummary] = useState<GroupComputationResult | null>(null);
  const [breakdown, setBreakdown] = useState<GroupComputationResult['breakdown'] | undefined>(undefined);
  const [isComputing, setIsComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const engine = useMemo(() => createComputeEngine(sourceType), [sourceType]);
  const cache = useMemo(() => createComputationCache(sourceType), [sourceType]);

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

  // ─────────────────────────────────────────────────────────────
  // 5. ЯДРО ВЫЧИСЛЕНИЙ
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeDatasetId || !group || isSyncing) {
      setSummary(null);
      setBreakdown(undefined);
      return;
    }

    let cancelled = false;
    const compute = async () => {
      setIsComputing(true);
      setError(null);

      const cacheKey = {
        datasetId: activeDatasetId,
        dashboardId: `group:${groupId}`,
        filtersHash: `${filtersHash}:${configHash}`,
      };

      const cached = await cache.get(cacheKey);
      if (cached && !cancelled) {
        const res = cached.result as DashboardComputationResult;
        setSummary(res.groups[0] || null);
        setBreakdown(res.groups[0]?.breakdown);
        setIsComputing(false);
        return;
      }

      try {
        const params: ClientComputeParams = {
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
        };

        await engine.initialize(activeDatasetId);
        const result = await engine.compute(params);

        if (cancelled) return;

        setSummary(result.groups[0] || null);
        setBreakdown(result.groups[0]?.breakdown);
        await cache.set(cacheKey, result);
      } catch (err) {
        if (!cancelled) {
          console.error('[GroupBreakdown] Compute failed:', err);
          setError(err instanceof Error ? err.message : 'Ошибка вычисления');
        }
      } finally {
        if (!cancelled) setIsComputing(false);
      }
    };

    compute();
    return () => { cancelled = true; };
  }, [
    activeDatasetId, groupId, group, isSyncing, filtersHash, configHash,
    currentPath, dashboardGroupsConfig, templates, virtualMetrics, groupByColumn,
    engine, cache, encryptedConnection,
  ]);

  // ─────────────────────────────────────────────────────────────
  // 6. НАВИГАЦИЯ DRILL-DOWN
  // ─────────────────────────────────────────────────────────────
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
    virtualMetrics,
    isComputing,
    error,
    drillDown,
    resetToLevel,
    resetAll,
  };
}