'use client';

import { useState, useCallback } from 'react';
import { nanoid } from 'nanoid';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { useIndicatorGroupStore } from '@/lib/stores/indicator-group-store';
import { 
  Dashboard, 
  VirtualMetric, 
  IndicatorGroupInDashboard, 
  VirtualMetricBindingInDashboard 
} from '@/types';

export function useDashboardBuilder(existingDashboardId?: string) {
  const { addDashboard, updateDashboard, getDashboard } = useDashboardStore();
  const allGroups = useIndicatorGroupStore(s => s.groups);

  // Инициализация состояния (если редактируем, берем из стора)
  const existingDashboard = existingDashboardId ? getDashboard(existingDashboardId) : null;

  const [name, setName] = useState(existingDashboard?.name || '');
  const [description, setDescription] = useState(existingDashboard?.description || '');
  
  // 1. Виртуальные метрики (Колонки)
  const [virtualMetrics, setVirtualMetrics] = useState<VirtualMetric[]>(
    existingDashboard?.virtualMetrics || []
  );

  // 2. Группы на дашборде (Строки + Привязки)
  const [dashboardGroups, setDashboardGroups] = useState<IndicatorGroupInDashboard[]>(
    existingDashboard?.indicatorGroups || []
  );

  // --- Действия с Виртуальными Метриками ---

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

  // --- Действия с Группами ---

  const addGroupToDashboard = useCallback((groupId: string) => {
    if (dashboardGroups.some(g => g.groupId === groupId)) return;

    const newGroupConfig: IndicatorGroupInDashboard = {
      groupId,
      enabled: true,
      order: dashboardGroups.length,
      virtualMetricBindings: [] // Пустые привязки при создании
    };
    setDashboardGroups(prev => [...prev, newGroupConfig]);
  }, [dashboardGroups]);

  const removeGroupFromDashboard = useCallback((groupId: string) => {
    setDashboardGroups(prev => prev.filter(g => g.groupId !== groupId));
  }, []);

  // --- Самое важное: Привязка (Mapping) ---
  
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
        // Обновляем существующую
        newBindings = [...existingBindings];
        newBindings[idx] = { virtualMetricId, metricId };
      } else {
        // Добавляем новую
        newBindings = [...existingBindings, { virtualMetricId, metricId }];
      }

      return { ...group, virtualMetricBindings: newBindings };
    }));
  }, []);

  // --- Сохранение ---

  const saveDashboard = useCallback(() => {
    if (!name.trim()) throw new Error("Введите название дашборда");

    const dashboardData: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'> = {
      name,
      description,
      virtualMetrics,
      hierarchyFilters: existingDashboard?.hierarchyFilters || [], // Сохраняем текущие фильтры если были
      indicatorGroups: dashboardGroups,
      widgets: existingDashboard?.widgets || [],
      isPublic: false,
      kpiWidgets: existingDashboard?.kpiWidgets || []
    };

    if (existingDashboardId) {
      updateDashboard(existingDashboardId, dashboardData);
      return existingDashboardId;
    } else {
      return addDashboard(dashboardData);
    }
  }, [name, description, virtualMetrics, dashboardGroups, existingDashboardId, existingDashboard, addDashboard, updateDashboard]);

  return {
    name, setName,
    description, setDescription,
    virtualMetrics, addVirtualMetric, removeVirtualMetric,
    dashboardGroups, addGroupToDashboard, removeGroupFromDashboard,
    updateBinding,
    saveDashboard,
    availableGroups: allGroups // Для селекта добавления
  };
}