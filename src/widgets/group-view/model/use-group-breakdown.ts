'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useDatasetStore } from '@/entities/dataset';
import { useAppSettingsStore, selectFormulaOptions } from '@/entities/app-settings';
import { useColumnDictionary } from '@/entities/reference-type';
import { useHierarchyStore, type HierarchyLevel } from '@/entities/hierarchy';
import { useIndicatorGroupStore } from '@/entities/indicator-group';
import { useMetricTemplateStore, type IndicatorGroup } from '@/entities/metric';
import { useColumnConfigStore } from '@/entities/column-config';
import { useGroupMetricConfigStore } from '@/entities/group-metric-config';
import { useGroupViewPrefsStore } from './group-view-prefs-store';
import {
  buildVirtualMetric,
  useDatasetInfo,
} from '@/entities/group-view';
import { useShallow } from 'zustand/react/shallow';
import type { CacheKey } from '@/shared/lib/storage';
import { generateFiltersHash, generateConfigHash } from '@/shared/lib/utils/hash';
import type { ClientComputeParams, SecondaryDimension } from '@/shared/lib/computation/lib/types';
import type {
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
  /** Вторая ось разбивки (дата|колонка|бакеты) или null — только иерархия. */
  secondary: SecondaryDimension | null;
  setSecondary: (s: SecondaryDimension | null) => void;
  /** Категориальные колонки-кандидаты во вторую ось (кроме текущего уровня). */
  secondaryColumns: { columnName: string; displayName: string }[];
  /** true — двумерный режим: следующий уровень иерархии × вторая ось. */
  isTwoDimensional: boolean;
  /**
   * Код → наименование по справочнику колонки текущего уровня
   * (только отображение; в фильтры и ключи уходят коды).
   */
  resolveLabel: (label: string) => string;
}

export function useGroupBreakdown(
  groupId: string,
  pathValues: string[], // только значения уровней (из URL, компактно)
  setPathValues: (values: string[]) => void // запись значений в URL
): GroupBreakdownResult {
  // Вторая ось 2-D персистится per-group (group-view-prefs-store) — восстанавливаем
  // выбор между визитами. Сырое значение валидируем ниже (колонка/дата могли
  // исчезнуть), сеттер пишет в стор.
  const storedSecondary = useGroupViewPrefsStore(s => s.prefsByGroup[groupId]?.secondary) ?? null;
  const setGroupPrefs = useGroupViewPrefsStore(s => s.setPrefs);
  const setSecondary = useCallback(
    (s: SecondaryDimension | null) => setGroupPrefs(groupId, { secondary: s }),
    [groupId, setGroupPrefs]
  );

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

  // Полный путь из URL-значений: поля уровня (id/index/columnName) берём из
  // иерархии по позиции — путь всегда префикс уровней от корня (drill-down идёт
  // строго по уровням). displayValue в URL не храним — крошки резолвят его сами.
  const currentPath = useMemo<HierarchyFilterValue[]>(
    () =>
      pathValues.map((value, idx) => {
        const lvl = levels[idx];
        return {
          levelId: lvl?.id ?? `lvl-${idx}`,
          levelIndex: lvl?.order ?? idx,
          columnName: lvl?.columnName ?? '',
          value,
        };
      }),
    [pathValues, levels]
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
      // Стиль чарта (столбец/линия) — только из группового стора (per-group).
      const chartStyle = vm.sourceMetricId
        ? groupMetricConfigs?.[vm.sourceMetricId]?.chartStyle
        : undefined;
      return { ...vm, colorConfig, chartStyle };
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
  // Категориальные колонки-кандидаты во вторую ось (кроме текущего уровня —
  // он уже первая ось).
  const secondaryColumns = useMemo(
    () =>
      columnConfigs
        .filter(c => c.classification === 'categorical' && c.columnName !== nextLevel?.columnName)
        .map(c => ({ columnName: c.columnName, displayName: c.displayName || c.columnName })),
    [columnConfigs, nextLevel?.columnName]
  );
  // Валидация восстановленного выбора: дата/колонка могли исчезнуть (скрыта,
  // другой набор колонок) → не активируем 2-D с битой осью.
  const secondary = useMemo<SecondaryDimension | null>(() => {
    if (!storedSecondary) return null;
    if (storedSecondary.kind === 'date') return dateColumn ? storedSecondary : null;
    if (storedSecondary.kind === 'column')
      return validColumns.includes(storedSecondary.columnName) ? storedSecondary : null;
    return storedSecondary; // bucket — отдельной валидации пока нет
  }, [storedSecondary, dateColumn, validColumns]);

  const isTwoDimensional = secondary !== null && nextLevel !== null;
  const groupByColumn = nextLevel?.columnName;

const formulaOptions = useAppSettingsStore(useShallow(selectFormulaOptions));  
const formulaOptionsHash = `${formulaOptions.defaultAggregate}:${formulaOptions.requireExplicit}`;

  // Сериализация второй оси для ключа кэша/конфига.
  const secondaryHash = secondary
    ? `:sec:${secondary.kind}:${secondary.columnName}:${
        secondary.kind === 'date' ? secondary.granularity
        : secondary.kind === 'bucket' ? `b${secondary.bucketCount}` : ''
      }:${secondary.kind !== 'date' && secondary.topN ? `t${secondary.topN}` : ''}`
    : '';

  const configHash = useMemo(() => {
    return (
      generateConfigHash({
        groups: group ? [group] : [],
        metricTemplates: templates,
        dashboardGroupsConfig,
        virtualMetrics,
      }) +
      (groupByColumn ? `:gb:${groupByColumn}` : '') +
      secondaryHash +
      `:fo:${formulaOptionsHash}`
    );
  }, [group, templates, dashboardGroupsConfig, virtualMetrics, groupByColumn, secondaryHash, formulaOptionsHash]);

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
      secondary: secondary ?? undefined,
      formulaOptions,
      validColumns,
      pgSchema,
      pgTable,
    };
  }, [
    activeDatasetId, group, groupId, encryptedConnection, currentPath,
    dashboardGroupsConfig, templates, virtualMetrics,
    groupByColumn, secondary,
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
      // В URL уходит только значение (label) — поля уровня восстановятся.
      if (!nextLevel) return;
      setPathValues([...pathValues, label]);
    },
    [nextLevel, pathValues, setPathValues]
  );

  // Клик по хлебной крошке = выбрать ЭТОТ уровень (оставить его в пути),
  // а не удалить. slice(0, idx+1) сохраняет кликнутый уровень и отбрасывает
  // только более глубокие. Подъём выше — клик по родительской крошке или
  // «Все данные».
  const resetToLevel = useCallback((levelIndex: number) => {
    setPathValues(pathValues.slice(0, levelIndex + 1));
  }, [pathValues, setPathValues]);

  const resetAll = useCallback(() => {
    setPathValues([]);
  }, [setPathValues]);

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
    secondary,
    setSecondary,
    secondaryColumns,
    isTwoDimensional,
    resolveLabel,
  };
}