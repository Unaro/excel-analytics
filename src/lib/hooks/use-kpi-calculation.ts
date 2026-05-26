'use client';
import { useEffect, useMemo, useState } from 'react';
import { useDatasetStore } from '@/entities/dataset';
import { DashboardComputationResult, MetricTemplate, useMetricTemplateStore } from '@/entities/metric';
import { createComputeEngine } from '@/features/computation/lib/engine-factory';
import { compileKPIsToComputeParams, KPI_VIRTUAL_GROUP_ID } from '@/features/computation/lib/kpi-compiler';
import { createComputationCache } from '@/lib/storage';
import { generateFiltersHash } from '@/shared/lib/utils/hash';
import type { ClientComputeParams } from '@/features/computation/lib/types';
import { KPIWidget } from '@/entities/dashboard';
import { HierarchyFilterValue } from '@/shared/lib/validators';


export interface KPIResult {
  widget: KPIWidget;
  template: MetricTemplate;
  value: number;
  formattedValue: string;
  error?: string;
}

/**
 * Вычисляет KPI-виджеты через DuckDB (для файлов) или PostgreSQL.
 * Использует тот же engine что и дашборд, обеспечивая согласованность цифр.
 */
export function useKPICalculation(
  widgets: KPIWidget[],
  filters: HierarchyFilterValue[]
): KPIResult[] {
  const activeDatasetId = useDatasetStore(s => s.activeDatasetId);
  const dataset = useDatasetStore(s => s.getActiveDataset());
  const sourceType = dataset?.sourceType ?? 'file';
  const isSyncing = useDatasetStore(s => s.isSyncing);
  const templates = useMetricTemplateStore(s => s.templates);

  const [results, setResults] = useState<KPIResult[]>([]);
  const engine = useMemo(() => createComputeEngine(sourceType), [sourceType]);
  const cache = useMemo(() => createComputationCache(sourceType), [sourceType]);

  // Детерминированные ключи
  const filtersHash = useMemo(() => generateFiltersHash(filters), [filters]);
  const widgetsKey = useMemo(
    () => widgets.map(w => `${w.id}:${w.templateId}:${JSON.stringify(w.bindings)}`).join('|'),
    [widgets]
  );

  useEffect(() => {
    if (!activeDatasetId || widgets.length === 0 || isSyncing) {
      setResults([]);
      return;
    }

    let cancelled = false;

    const compute = async () => {
      try {
        // 1. Компилируем KPI в формат для engine
        const compiled = compileKPIsToComputeParams(widgets, templates);
        if (compiled.groups[0].metrics.length === 0) {
          setResults([]);
          return;
        }

        // 2. Проверяем кэш (отдельный namespace для KPI)
        const cacheKey = {
          datasetId: activeDatasetId,
          dashboardId: `kpi:${widgetsKey}`,
          filtersHash,
        };
        const cached = await cache.get(cacheKey);
        if (cached && !cancelled) {
          setResults(mapResultsToKPI(cached.result, widgets, templates, compiled.widgetToVmMap));
          return;
        }

        // 3. Запускаем engine.compute
        const params: ClientComputeParams = {
          datasetId: activeDatasetId,
          dashboardId: `kpi:${widgetsKey}`,
          tableName: 'kpi-data', 
          encryptedConfig: dataset?.pgConfig?.encryptedConnection,
          filters,
          groups: compiled.groups,
          dashboardGroupsConfig: compiled.dashboardGroupsConfig,
          metricTemplates: templates,
          virtualMetrics: compiled.virtualMetrics,
        };

        await engine.initialize(activeDatasetId);
        const result: DashboardComputationResult = await engine.compute(params);

        if (cancelled) return;

        // 4. Кэшируем и маппим
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
  }, [activeDatasetId, widgetsKey, filtersHash, sourceType, engine, cache, templates, dataset, widgets, filters, isSyncing]);

  return results;
}

/**
 * Извлекает значения KPI из DashboardComputationResult
 */
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