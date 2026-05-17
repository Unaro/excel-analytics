'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useDatasetStore } from '@/entities/dataset';
import { useIndicatorGroupStore } from '@/entities/indicatorGroup';
import { useMetricTemplateStore } from '@/entities/metric';
import { computeDashboardMetrics } from '@/app/actions/compute';
import {
  HierarchyFilterValue,
  VirtualMetric,
  IndicatorGroupInDashboard,
  GroupComputationResult
} from '@/types';
import { toast } from 'sonner';

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
      return {
        id: `vm-${m.id}`,
        name: `${m.customName}(${tpl?.name})` || m.customName || tpl?.name || 'Metric',
        displayFormat: tpl?.displayFormat || 'number',
        decimalPlaces: tpl?.decimalPlaces || 2,
        order: m.order ?? 0,
        unit: tpl?.suffix || tpl?.prefix,
      };
    });
    const groupConfig: IndicatorGroupInDashboard = {
      groupId: group.id,
      enabled: true,
      order: 0,
      virtualMetricBindings: group.metrics.map(m => ({
        virtualMetricId: `vm-${m.id}`,
        metricId: m.id
      }))
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
        filters: filters
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