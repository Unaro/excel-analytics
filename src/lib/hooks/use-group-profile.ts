'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useDatasetStore } from '@/entities/dataset';
import { useIndicatorGroupStore } from '@/entities/indicatorGroup';
import { GroupComputationResult, useMetricTemplateStore } from '@/entities/metric';
import { toast } from 'sonner';
import { buildVmIdFromFields } from '@/shared/lib/utils/metric-ids';
import { HierarchyFilterValue, IndicatorGroupInDashboard, VirtualMetric } from '@/shared/lib/validators';
import { computeDashboardMetrics } from '@/app/actions/compute';

/**
 * Хук для страницы профиля группы (single-group view без drill-down).
 */
export function useGroupProfile(groupId: string, filters: HierarchyFilterValue[]) {
  const excelData = useDatasetStore(s => s.getAllData());
  const group = useIndicatorGroupStore(s => s.getGroup(groupId));
  const templates = useMetricTemplateStore(s => s.templates);
  const [result, setResult] = useState<GroupComputationResult | null>(null);
  const [isComputing, setIsComputing] = useState(false);

  const { virtualMetrics, dashboardConfig } = useMemo(() => {
    if (!group) return { virtualMetrics: [], dashboardConfig: [] };

    const vMetrics: VirtualMetric[] = group.metrics.map(m => {
      const tpl = templates.find(t => t.id === m.templateId);
      const name = m.customName || tpl?.name || 'Metric';
      const displayFormat = tpl?.displayFormat || 'number';
      const decimalPlaces = tpl?.decimalPlaces || 2;
      const unit = tpl?.suffix || tpl?.prefix;
      return {
        id: buildVmIdFromFields(name, displayFormat, decimalPlaces, unit),
        name,
        displayFormat,
        decimalPlaces,
        order: m.order ?? 0,
        unit,
      };
    });

    const groupConfig: IndicatorGroupInDashboard = {
      groupId: group.id,
      enabled: true,
      order: 0,
      virtualMetricBindings: group.metrics.map(m => {
        const tpl = templates.find(t => t.id === m.templateId);
        const name = `${m.customName}(${tpl?.name})` || m.customName || tpl?.name || 'Metric';
        const displayFormat = tpl?.displayFormat || 'number';
        const decimalPlaces = tpl?.decimalPlaces || 2;
        const unit = tpl?.suffix || tpl?.prefix;
        return {
          virtualMetricId: buildVmIdFromFields(name, displayFormat, decimalPlaces, unit),
          metricId: m.id,
        };
      }),
    };

    return { virtualMetrics: vMetrics, dashboardConfig: [groupConfig] };
  }, [group, templates]);

  const runCalculation = useCallback(async () => {
    if (!group || excelData.length === 0) return;
    setIsComputing(true);
    try {
      const res = await computeDashboardMetrics({
        dashboardId: 'temp-profile',
        data: excelData,
        allGroups: [group],
        dashboardGroupsConfig: dashboardConfig,
        metricTemplates: templates,
        virtualMetrics: virtualMetrics,
        filters: filters,
      });
      setResult(res.groups[0] || null);
    } catch (error) {
      console.error('Group profile calculation error:', error);
      toast.error(error instanceof Error ? error.message : 'Ошибка вычисления показателей');
    } finally {
      setIsComputing(false);
    }
  }, [excelData, group, dashboardConfig, templates, virtualMetrics, filters]);

  useEffect(() => { runCalculation(); }, [runCalculation]);

  return { group, result, isComputing, virtualMetrics };
}