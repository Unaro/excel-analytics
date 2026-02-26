'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useExcelDataStore } from '@/entities/excelData';
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
  const sheets = useExcelDataStore(s => s.data);
  const excelData = useMemo(() => sheets ? sheets.flatMap(s => s.rows) : [], [sheets]);

  const group = useIndicatorGroupStore(s => s.getGroup(groupId));
  const templates = useMetricTemplateStore(s => s.templates);

  const [result, setResult] = useState<GroupComputationResult | null>(null);
  const [isComputing, setIsComputing] = useState(false);

  // Генерируем конфигурацию "на лету"
  const { virtualMetrics, dashboardConfig } = useMemo(() => {
    if (!group) return { virtualMetrics: [], dashboardConfig: [] };

    // 1. Создаем виртуальную метрику для КАЖДОЙ метрики группы
    const vMetrics: VirtualMetric[] = group.metrics.map(m => {
      const tpl = templates.find(t => t.id === m.templateId);
      return {
        id: `vm-${m.id}`, // Временный ID
        name: tpl?.name || 'Metric',
        displayFormat: tpl?.displayFormat || 'number',
        decimalPlaces: tpl?.decimalPlaces || 2,
        order: m.order ?? 0,
        unit: tpl?.suffix || tpl?.prefix,
      };
    });

    // 2. Создаем конфиг группы
    const groupConfig: IndicatorGroupInDashboard = {
      groupId: group.id,
      enabled: true,
      order: 0,
      virtualMetricBindings: group.metrics.map(m => ({
        virtualMetricId: `vm-${m.id}`, // Связываем 1 к 1
        metricId: m.id
      }))
    };

    return {
      virtualMetrics: vMetrics,
      dashboardConfig: [groupConfig]
    };
  }, [group, templates]);

  const runCalculation = useCallback(async () => {
    if (!group || excelData.length === 0) return;

    setIsComputing(true);
    try {
      // Используем тот же Server Action, что и для дашбордов!
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
      // ✅ Показываем ошибку пользователю через toast
      toast.error(
        error instanceof Error ? error.message : 'Ошибка вычисления показателей'
      );
    } finally {
      setIsComputing(false);
    }
  }, [excelData, group, dashboardConfig, templates, virtualMetrics, filters]);

  // Авто-запуск при смене фильтров
  useEffect(() => {
    runCalculation();
  }, [runCalculation]);

  return {
    group,
    result,
    isComputing,
    virtualMetrics // Чтобы знать названия метрик для отображения
  };
}