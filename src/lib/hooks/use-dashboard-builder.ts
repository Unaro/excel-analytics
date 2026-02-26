'use client';

import { useState, useCallback, useMemo } from 'react';
import { nanoid } from 'nanoid';
import { useDashboardStore } from '@/entities/dashboard';
import { useIndicatorGroupStore } from '@/entities/indicatorGroup';
import {
  Dashboard,
  VirtualMetric,
  IndicatorGroupInDashboard,
  VirtualMetricBindingInDashboard
} from '@/types';

export function useDashboardBuilder(existingDashboardId?: string) {
  // Сначала ВСЕ хуки — никаких условий до useState
  const { addDashboard, updateDashboard, getDashboard } = useDashboardStore();
  const allGroups = useIndicatorGroupStore(s => s.groups);

  // Мемоизируем existingDashboard
  const existingDashboard = useMemo(
    () => (existingDashboardId ? getDashboard(existingDashboardId) : null),
    [existingDashboardId, getDashboard]
  );

  // Инициализация — значения вычисляются до useState
  const initialName = existingDashboard?.name || '';
  const initialDescription = existingDashboard?.description || '';
  const initialVirtualMetrics: VirtualMetric[] = existingDashboard?.virtualMetrics || [];
  const initialDashboardGroups: IndicatorGroupInDashboard[] = existingDashboard?.indicatorGroups || [];

  // useState вызываются в фиксированном порядке
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [virtualMetrics, setVirtualMetrics] = useState<VirtualMetric[]>(initialVirtualMetrics);
  const [dashboardGroups, setDashboardGroups] = useState<IndicatorGroupInDashboard[]>(initialDashboardGroups);

  const addVirtualMetric = useCallback((name: string) => {
    const newMetric: VirtualMetric = {
      id: nanoid(),
      name,
      displayFormat: 'number',
      decimalPlaces: 0,
      order: virtualMetrics.length
    };
    setVirtualMetrics(prev => [...prev, newMetric]);
  }, [virtualMetrics.length]);

  const removeVirtualMetric = useCallback((id: string) => {
    setVirtualMetrics(prev => prev.filter(vm => vm.id !== id));
  }, []);

  const addGroupToDashboard = useCallback((groupId: string) => {
    if (dashboardGroups.some(g => g.groupId === groupId)) return;
    const newGroupConfig: IndicatorGroupInDashboard = {
      groupId,
      enabled: true,
      order: dashboardGroups.length,
      virtualMetricBindings: []
    };
    setDashboardGroups(prev => [...prev, newGroupConfig]);
  }, [dashboardGroups]);

  const removeGroupFromDashboard = useCallback((groupId: string) => {
    setDashboardGroups(prev => prev.filter(g => g.groupId !== groupId));
  }, []);

  const updateBinding = useCallback((
    groupId: string,
    virtualMetricId: string,
    metricId: string
  ) => {
    setDashboardGroups(prev => prev.map(group => {
      if (group.groupId !== groupId) return group;
      const existingBindings = group.virtualMetricBindings || [];
      const idx = existingBindings.findIndex(b => b.virtualMetricId === virtualMetricId);
      let newBindings: VirtualMetricBindingInDashboard[];
      if (idx >= 0) {
        newBindings = [...existingBindings];
        newBindings[idx] = { virtualMetricId, metricId };
      } else {
        newBindings = [...existingBindings, { virtualMetricId, metricId }];
      }
      return { ...group, virtualMetricBindings: newBindings };
    }));
  }, []);

  const saveDashboard = useCallback(() => {
    if (!name.trim()) throw new Error('Введите название дашборда');
    const dashboardData: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'> = {
      name,
      description,
      virtualMetrics,
      hierarchyFilters: existingDashboard?.hierarchyFilters || [],
      indicatorGroups: dashboardGroups,
      widgets: existingDashboard?.widgets || [],
      isPublic: false,
      kpiWidgets: existingDashboard?.kpiWidgets || []
    };
    if (existingDashboardId) {
      updateDashboard(existingDashboardId, dashboardData);
      return existingDashboardId;
    }
    return addDashboard(dashboardData);
  }, [name, description, virtualMetrics, dashboardGroups, existingDashboardId, existingDashboard, addDashboard, updateDashboard]);

  return {
    name, setName,
    description, setDescription,
    virtualMetrics, addVirtualMetric, removeVirtualMetric,
    dashboardGroups, addGroupToDashboard, removeGroupFromDashboard,
    updateBinding,
    saveDashboard,
    availableGroups: allGroups
  };
}
