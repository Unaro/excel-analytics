'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDatasetStore } from '@/entities/dataset';
import { useAppSettingsStore, selectFormulaOptions } from '@/entities/app-settings';
import { useColumnDictionary } from '@/entities/reference-type';
import { useHierarchyStore, type HierarchyLevel } from '@/entities/hierarchy';
import { useIndicatorGroupStore } from '@/entities/indicator-group';
import { useMetricTemplateStore, type IndicatorGroup } from '@/entities/metric';
import { useColumnConfigStore } from '@/entities/column-config';
import { useGroupMetricConfigStore } from '@/entities/group-metric-config';
import {
  buildVirtualMetric,
  useDatasetInfo,
} from '@/entities/group-view';
import { useShallow } from 'zustand/react/shallow';
import type { CacheKey } from '@/shared/lib/storage';
import { generateFiltersHash, generateConfigHash } from '@/shared/lib/utils/hash';
import type { ClientComputeParams, DateGranularity } from '@/shared/lib/computation/lib/types';
import type {
  GroupMetric,
  HierarchyFilterValue,
  IndicatorGroupInDashboard,
  MetricTemplate,
  VirtualMetric,
} from '@/shared/lib/validators';
import type { ColumnConfig } from '@/shared/lib/types';
import { useComputation } from '@/shared/lib/computation/hooks/use-computation';
import type { GroupComputationResult } from '@/shared/lib/types/computation';

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
  /** Первая колонка датасета с классификацией «Дата» (null — нет таких). */
  dateColumn: ColumnConfig | null;
  /** Активная размерность временно́й группировки (null — только иерархия). */
  dateGranularity: DateGranularity | null;
  setDateGranularity: (g: DateGranularity | null) => void;
  /** true — двумерный режим: следующий уровень иерархии × время. */
  isTwoDimensional: boolean;
  /**
   * Код → наименование по справочнику колонки текущего уровня
   * (только отображение; в фильтры и ключи уходят коды).
   */
  resolveLabel: (label: string) => string;
}

export function useGroupBreakdown(
  groupId: string,
  currentPath: HierarchyFilterValue[], // Переименовали из initialPath, теперь это path из URL
  setPath: (p: HierarchyFilterValue[]) => void // Добавили сеттер
): GroupBreakdownResult {
  const [dateGranularity, setDateGranularity] = useState<DateGranularity | null>(null);

  const {
    activeDatasetId,
    sourceType,
    encryptedConnection,
    pgSchema,
    pgTable,
    isSyncing,
  } = useDatasetInfo();

  const group = useIndicatorGroupStore(useShallow(s => s.getGroup(groupId)));
  const templates = useMetricTemplateStore(useShallow(s => s.templates)) ?? EMPTY_TEMPLATES;

  // Авто-переключение на датасет группы — как на странице дашборда
  // (use-dashboard-dataset-sync): страница группы всегда работает
  // с привязанными данными, а не со случайно активным датасетом.
  useEffect(() => {
    if (!group?.datasetId) return;
    if (group.datasetId === activeDatasetId) return;
    useDatasetStore.getState().switchDataset(group.datasetId);
  }, [group?.datasetId, activeDatasetId]);

  const levels = useHierarchyStore(
    useShallow(s => (activeDatasetId ? s.getLevels(activeDatasetId) : EMPTY_LEVELS))
  );

  const columnConfigs = useColumnConfigStore(s =>
    activeDatasetId ? (s.configsByDataset[activeDatasetId] ?? EMPTY_CONFIGS) : EMPTY_CONFIGS
  );

  const validColumns = useMemo(
    () => columnConfigs.filter(c => c.classification !== 'ignore').map(c => c.columnName),
    [columnConfigs]
  );

  const groupMetricConfigs = useGroupMetricConfigStore(s => s.configsByGroup[groupId]);

  const nextLevel = useMemo<HierarchyLevel | null>(                                   
    () => levels[currentPath.length] ?? null,
    [levels, currentPath.length]
  );

  const virtualMetrics = useMemo<VirtualMetric[]>(() => {
    if (!group) return [];
    return group.metrics.map((m, idx) => {
      const tpl = templates.find(t => t.id === m.templateId);
      return buildVirtualMetric(group.id, m, tpl, idx);
    });
  }, [group, templates]);

  const virtualMetricsForUI = useMemo<VirtualMetric[]>(() => {
    if (!group) return [];
    return virtualMetrics.map(vm => {
      // CF — единый источник на шаблоне; групповой стор остаётся фолбэком
      // для немигрированных метрик (правила «переедут» при редактировании).
      const m = vm.sourceMetricId
        ? group.metrics.find(gm => gm.id === vm.sourceMetricId)
        : undefined;
      const tpl = m ? templates.find(t => t.id === m.templateId) : undefined;
      const colorConfig = tpl?.colorConfig
        ?? (vm.sourceMetricId ? groupMetricConfigs?.[vm.sourceMetricId]?.colorConfig : undefined);
      return { ...vm, colorConfig };
    });
  }, [virtualMetrics, groupMetricConfigs, group, templates]);

  const dashboardGroupsConfig = useMemo<IndicatorGroupInDashboard[]>(() => {
    if (!group) return [];
    return [{
      groupId: group.id,
      enabled: true,
      order: 0,
      virtualMetricBindings: group.metrics.map((m, idx) => {
        const tpl = templates.find(t => t.id === m.templateId);
        const vm = buildVirtualMetric(group.id, m, tpl, idx);
        return { virtualMetricId: vm.id, metricId: m.id };
      }),
    }];
  }, [group, templates]);

  const filtersHash = useMemo(() => generateFiltersHash(currentPath), [currentPath]);

  // Временна́я группировка ДОБАВЛЯЕТСЯ к текущему уровню иерархии:
  //  - есть следующий уровень → двумерный режим (категория × время);
  //  - достигнут лист → одномерная разбивка по временны́м интервалам.
  // Текущие фильтры пути продолжают применяться в WHERE.
  const dateColumn = useMemo(
    () => columnConfigs.find(c => c.classification === 'date') ?? null,
    [columnConfigs]
  );
  const isTimeMode = dateGranularity !== null && dateColumn !== null;
  const isTwoDimensional = isTimeMode && nextLevel !== null;
  const groupByColumn = nextLevel?.columnName;
  const groupByDateColumn = isTimeMode ? dateColumn.columnName : undefined;

const formulaOptions = useAppSettingsStore(useShallow(selectFormulaOptions));  
const formulaOptionsHash = `${formulaOptions.defaultAggregate}:${formulaOptions.requireExplicit}`;

  const configHash = useMemo(() => {
    return (
      generateConfigHash({
        groups: group ? [group] : [],
        metricTemplates: templates,
        dashboardGroupsConfig,
        virtualMetrics,
      }) +
      (groupByColumn ? `:gb:${groupByColumn}` : '') +
      (isTimeMode ? `:dc:${groupByDateColumn}:dg:${dateGranularity}` : '') +
      `:fo:${formulaOptionsHash}`
    );
  }, [group, templates, dashboardGroupsConfig, virtualMetrics, groupByColumn, isTimeMode, groupByDateColumn, dateGranularity, formulaOptionsHash]);

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
      groupByDateColumn,
      groupByDateGranularity: isTimeMode ? dateGranularity : undefined,
      formulaOptions,
      validColumns,
      pgSchema,
      pgTable,
    };
  }, [
    activeDatasetId, group, groupId, encryptedConnection, currentPath,
    dashboardGroupsConfig, templates, virtualMetrics,
    groupByColumn, groupByDateColumn, isTimeMode, dateGranularity,
    formulaOptions, validColumns, pgSchema, pgTable,
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
    deps: [filtersHash, configHash, group?.id],
    label: 'group',
  });

  const summary = computeResult?.groups[0] ?? null;
  const breakdown = computeResult?.groups[0]?.breakdown;

  // Справочник колонки текущего уровня: имена в drill-down/крошках/таблицах
  const { resolve: resolveLabel } = useColumnDictionary(
    activeDatasetId,
    nextLevel?.columnName
  );

  const drillDown = useCallback(
    (label: string) => {
      // В двумерном режиме label — значение уровня иерархии, спуск валиден;
      // в режиме «только время» nextLevel === null, и спуск невозможен.
      if (!nextLevel) return;
      const newFilter: HierarchyFilterValue = {
        levelId: nextLevel.id,
        levelIndex: nextLevel.order,
        columnName: nextLevel.columnName,
        value: label,
        // Имя из справочника — в крошках виден текст, в WHERE уходит код
        displayValue: resolveLabel(label),
      };
      setPath([...currentPath, newFilter]); 
    },
      [nextLevel, resolveLabel, currentPath, setPath]
  );

  const resetToLevel = useCallback((levelIndex: number) => {
    setPath(currentPath.slice(0, levelIndex));
  }, [currentPath, setPath]);

  const resetAll = useCallback(() => {
    setPath([]);
  }, [setPath]);

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
    dateColumn,
    dateGranularity,
    setDateGranularity,
    isTwoDimensional,
    resolveLabel,
  };
}