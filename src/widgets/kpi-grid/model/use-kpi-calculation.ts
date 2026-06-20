'use client';

import { useCallback, useMemo } from 'react';
import { useDatasetStore } from '@/entities/dataset';
import { useMetricTemplateStore } from '@/entities/metric';
import { useAppSettingsStore, selectFormulaOptions } from '@/entities/app-settings';
import { useShallow } from 'zustand/react/shallow';
import {
  compileKPIsToComputeParams,
  KPI_VIRTUAL_GROUP_ID,
} from '@/shared/lib/computation/lib/kpi-compiler';
import { generateFiltersHash, generateConfigHash } from '@/shared/lib/utils/hash';
import type { ClientComputeParams } from '@/shared/lib/computation/lib/types';
import type { HierarchyFilterValue, MetricTemplate } from '@/shared/lib/validators';
import type { KPIWidget } from '@/entities/dashboard';
import type { DashboardComputationResult } from '@/entities/metric';
import { useColumnConfigStore } from '@/entities/column-config';
import type { CacheKey } from '@/shared/lib/storage';
import { useComputation } from '@/shared/lib/computation/hooks/use-computation';
import type { ColumnConfig } from '@/shared/lib/types';

export interface KPIResult {
  widget: KPIWidget;
  template: MetricTemplate;
  value: number;
  formattedValue: string;
  error?: string;
}

const EMPTY_CONFIG: ColumnConfig[] = [];
const EMPTY_RESULT: KPIResult[] = [];

export function useKPICalculation(
  dashboardId: string,
  widgets: KPIWidget[],
  filters: HierarchyFilterValue[]
): KPIResult[] {
  const activeDatasetId = useDatasetStore(s => s.activeDatasetId);
  const dataset = useDatasetStore(s => s.getActiveDataset());
  const sourceType = dataset?.sourceType ?? 'file';
  const isSyncing = useDatasetStore(s => s.isSyncing);
  const templates = useMetricTemplateStore(s => s.templates);
  const columnConfigs = useColumnConfigStore(s =>
    activeDatasetId ? s.configsByDataset[activeDatasetId] : EMPTY_CONFIG
  );

  const validColumns = useMemo(
    () =>
      columnConfigs
        .filter(c => c.classification !== 'ignore')
        .map(c => c.columnName),
    [columnConfigs]
  );

  const filtersHash = useMemo(() => generateFiltersHash(filters), [filters]);

  const compiled = useMemo(
    () => compileKPIsToComputeParams(widgets, templates),
    [widgets, templates]
  );

  const configHash = useMemo(() => {
    return generateConfigHash({
      groups: [
        {
          id: KPI_VIRTUAL_GROUP_ID,
          name: 'KPI',
          fieldMappings: [],
          metrics: widgets.map((w, idx) => ({
            id: `kpi_m_${w.id}`,
            templateId: w.templateId,
            fieldBindings: Object.entries(w.bindings).map(([alias, columnName]) => ({
              id: `fb_${w.id}_${alias}`,
              fieldAlias: alias,
              columnName,
            })),
            metricBindings: [],
            enabled: true,
            order: idx,
          })),
          order: 0,
          createdAt: 0,
          updatedAt: 0,
        },
      ],
      metricTemplates: templates,
      dashboardGroupsConfig: [
        {
          groupId: KPI_VIRTUAL_GROUP_ID,
          enabled: true,
          order: 0,
          virtualMetricBindings: widgets.map(w => ({
            virtualMetricId: `kpi_vm_${w.id}`,
            metricId: `kpi_m_${w.id}`,
          })),
        },
      ],
      virtualMetrics: widgets.map((w, idx) => ({
        id: `kpi_vm_${w.id}`,
        name:
          w.customName ||
          templates.find(t => t.id === w.templateId)?.name ||
          'KPI',
        displayFormat:
          templates.find(t => t.id === w.templateId)?.displayFormat || 'number',
        decimalPlaces:
          templates.find(t => t.id === w.templateId)?.decimalPlaces ?? 2,
        order: idx,
        unit: templates.find(t => t.id === w.templateId)?.unit,
      })),
    });
  }, [widgets, templates]);

  // useShallow обязателен: selectFormulaOptions возвращает новый объект на
  // каждый вызов; без него zustand v5 (useSyncExternalStore) уходит в
  // бесконечный цикл ререндеров («getSnapshot should be cached»).
  const formulaOptions = useAppSettingsStore(useShallow(selectFormulaOptions));
  const formulaOptionsHash = `${formulaOptions.defaultAggregate}:${formulaOptions.requireExplicit}`;

  const buildParams = useCallback((): ClientComputeParams | null => {
    if (!activeDatasetId || !dashboardId || compiled.groups[0].metrics.length === 0) {
      return null;
    }
    return {
      datasetId: activeDatasetId,
      dashboardId: dashboardId,
      tableName: 'placeholder',
      encryptedConfig: dataset?.pgConfig?.encryptedConnection,
      filters,
      groups: compiled.groups,
      dashboardGroupsConfig: compiled.dashboardGroupsConfig,
      metricTemplates: templates,
      virtualMetrics: compiled.virtualMetrics,
      formulaOptions,
      validColumns,
      pgSchema: dataset?.pgConfig?.schema,
      pgTable: dataset?.pgConfig?.table,
    };
  }, [
    activeDatasetId,
    dashboardId,
    compiled,
    dataset?.pgConfig,
    filters,
    templates,
    formulaOptions,
    validColumns,
  ]);

  const buildCacheKey = useCallback((): CacheKey | null => {
    if (!activeDatasetId || !dashboardId) return null;
    return {
      datasetId: activeDatasetId,
      dashboardId,
      filtersHash,
      configHash,
    };
  }, [activeDatasetId, dashboardId, filtersHash, configHash]);

  const { result } = useComputation({
    activeDatasetId,
    sourceType,
    isSyncing,
    buildParams,
    buildCacheKey,
    deps: [configHash, filtersHash, widgets.length, formulaOptionsHash],
    label: 'kpi',
  });

  return useMemo(() => {
    if (!result) return EMPTY_RESULT;
    return mapResultsToKPI(result, widgets, templates, compiled.widgetToVmMap);
  }, [result, widgets, templates, compiled.widgetToVmMap]);
}

function mapResultsToKPI(
  result: DashboardComputationResult,
  widgets: KPIWidget[],
  templates: MetricTemplate[],
  widgetToVmMap: Map<string, string>
): KPIResult[] {
  const kpiGroup = result.groups.find(g => g.groupId === KPI_VIRTUAL_GROUP_ID);
  if (!kpiGroup) return [];

  return widgets.map(widget => {
    const template = templates.find(t => t.id === widget.templateId)!;
    const vmId = widgetToVmMap.get(widget.id);
    const vmResult = kpiGroup.virtualMetrics.find(
      vm => vm.virtualMetricId === vmId
    );
    return {
      widget,
      template,
      value: vmResult?.value ?? 0,
      formattedValue: vmResult?.formattedValue ?? '—',
      error: vmResult?.error,
    };
  });
}