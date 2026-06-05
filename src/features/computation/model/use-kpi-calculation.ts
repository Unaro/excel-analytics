'use client';
import { useEffect, useMemo, useState } from 'react';
import { ColumnConfig, useDatasetStore } from '@/entities/dataset';
import { DashboardComputationResult, useMetricTemplateStore } from '@/entities/metric';
import { createComputeEngine } from '@/features/computation/lib/engine-factory';
import { compileKPIsToComputeParams, KPI_VIRTUAL_GROUP_ID } from '@/features/computation/lib/kpi-compiler';
import { createComputationCache } from '@/shared/lib/storage'; // ← ОБНОВЛЁННЫЙ ИМПОРТ
import { generateFiltersHash, generateConfigHash } from '@/shared/lib/utils/hash';
import type { ClientComputeParams } from '@/features/computation/lib/types';
import { HierarchyFilterValue, MetricTemplate } from '@/shared/lib/validators';
import { KPIWidget } from '@/entities/dashboard';
import { useColumnConfigStore } from '@/entities/columnConfig';

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

  const [results, setResults] = useState<KPIResult[]>(EMPTY_RESULT);

  const columnConfigs = useColumnConfigStore(s =>
    activeDatasetId ? s.configsByDataset[activeDatasetId] : EMPTY_CONFIG
  );

  const validColumns = useMemo(() =>
    columnConfigs.filter(c => c.classification !== 'ignore').map(c => c.columnName),
    [columnConfigs]
  );

  const engine = useMemo(() => createComputeEngine(sourceType), [sourceType]);
  const cache = useMemo(() => createComputationCache(sourceType), [sourceType]);

  const filtersHash = useMemo(() => generateFiltersHash(filters), [filters]);

  const configHash = useMemo(() => {
    return generateConfigHash({
      groups: [{
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
      }],
      metricTemplates: templates,
      dashboardGroupsConfig: [{
        groupId: KPI_VIRTUAL_GROUP_ID,
        enabled: true,
        order: 0,
        virtualMetricBindings: widgets.map(w => ({
          virtualMetricId: `kpi_vm_${w.id}`,
          metricId: `kpi_m_${w.id}`,
        })),
      }],
      virtualMetrics: widgets.map((w, idx) => ({
        id: `kpi_vm_${w.id}`,
        name: w.customName || templates.find(t => t.id === w.templateId)?.name || 'KPI',
        displayFormat: templates.find(t => t.id === w.templateId)?.displayFormat || 'number',
        decimalPlaces: templates.find(t => t.id === w.templateId)?.decimalPlaces || 2,
        order: idx,
        unit: templates.find(t => t.id === w.templateId)?.suffix,
      })),
    });
  }, [widgets, templates]);

  useEffect(() => {
    if (!activeDatasetId || !dashboardId || widgets.length === 0 || isSyncing) {
      setResults(EMPTY_RESULT);
      return;
    }

    let cancelled = false;

    const compute = async () => {
      try {
        const compiled = compileKPIsToComputeParams(widgets, templates);

        if (compiled.groups[0].metrics.length === 0) {
          setResults(EMPTY_RESULT);
          return;
        }

        const cacheKey = {
          datasetId: activeDatasetId,
          dashboardId: dashboardId,
          filtersHash,
          configHash,
        };

        const cached = await cache.get(cacheKey);
        if (cached && !cancelled) {
          setResults(mapResultsToKPI(cached.result, widgets, templates, compiled.widgetToVmMap));
          return;
        }

        const params: ClientComputeParams = {
          datasetId: activeDatasetId,
          dashboardId: dashboardId,
          tableName: 'placeholder',
          encryptedConfig: dataset?.pgConfig?.encryptedConnection,
          filters,
          groups: compiled.groups,
          dashboardGroupsConfig: compiled.dashboardGroupsConfig,
          metricTemplates: templates,
          virtualMetrics: compiled.virtualMetrics,
          validColumns
        };

        await engine.initialize(activeDatasetId);
        const result: DashboardComputationResult = await engine.compute(params);

        if (cancelled) return;

        await cache.set(cacheKey, result);
        setResults(mapResultsToKPI(result, widgets, templates, compiled.widgetToVmMap));
      } catch (err) {
        console.error('[KPICalculation] Compute failed:', err);
        if (!cancelled) {
          setResults(widgets.map(w => ({
            widget: w,
            template: templates.find(t => t.id === w.templateId)!,
            value: 0,
            formattedValue: 'Error',
            error: err instanceof Error ? err.message : 'Error',
          })));
        }
      }
    };

    compute();

    return () => { cancelled = true; };
  }, [activeDatasetId, dashboardId, configHash, filtersHash, sourceType, engine, cache, templates, dataset, widgets, filters, isSyncing]);

  return results;
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
    const vmResult = kpiGroup.virtualMetrics.find(vm => vm.virtualMetricId === vmId);

    return {
      widget,
      template,
      value: vmResult?.value ?? 0,
      formattedValue: vmResult?.formattedValue ?? '—',
      error: vmResult?.error,
    };
  });
}