'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { nanoid } from 'nanoid';
import { useIndicatorGroupStore } from '@/entities/indicator-group';
import { useDatasetStore } from '@/entities/dataset';
import { IndicatorGroupInDashboard, VirtualMetric, VirtualMetricBindingInDashboard } from '@/shared/lib/validators';
import { useDashboardStore } from '@/entities/dashboard';
import { Dashboard } from '@/entities/dashboard';

export function useDashboardBuilder(existingDashboardId?: string) {
  // Сначала ВСЕ хуки — никаких условий до useState.
  // Экшены стора стабильны — подписываемся точечно, а не на весь стор:
  // useDashboardStore() без селектора ререндерил форму билдера на любое
  // изменение любого дашборда (п.7 аудита ядра).
  const addDashboard = useDashboardStore(s => s.addDashboard);
  const updateDashboard = useDashboardStore(s => s.updateDashboard);
  const getDashboard = useDashboardStore(s => s.getDashboard);
  const allGroups = useIndicatorGroupStore(s => s.groups);
  const activeDatasetId = useDatasetStore(s => s.activeDatasetId);
  
  // useState вызываются в фиксированном порядке — БЕЗ вычислений до них
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [virtualMetrics, setVirtualMetrics] = useState<VirtualMetric[]>([]);
  const [dashboardGroups, setDashboardGroups] = useState<IndicatorGroupInDashboard[]>([]);

  // Мемоизируем existingDashboard
  const existingDashboard = useMemo(
    () => (existingDashboardId ? getDashboard(existingDashboardId) : null),
    [existingDashboardId, getDashboard]
  );

  // Загрузка данных дашборда при монтировании
  useEffect(() => {
    if (existingDashboard) {
      setName(existingDashboard.name || '');
      setDescription(existingDashboard.description || '');
      setVirtualMetrics(existingDashboard.virtualMetrics || []);
      setDashboardGroups(existingDashboard.indicatorGroups || []);
    }
  }, [existingDashboard]);

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

  // Единица измерения колонки дашборда: отображалась (formatValue,
  // таблица метрик), но задать её в билдере было негде.
  const updateVirtualMetricUnit = useCallback((id: string, unit: string) => {
    setVirtualMetrics(prev => prev.map(vm =>
      vm.id === id ? { ...vm, unit: unit || undefined } : vm
    ));
  }, []);

  const reorderVirtualMetrics = useCallback((newOrder: VirtualMetric[]) => {
    const reordered = newOrder.map((vm, idx) => ({ ...vm, order: idx }));
    setVirtualMetrics(reordered);
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

    const targetDatasetId = activeDatasetId || existingDashboard?.datasetId;
    if (!targetDatasetId) throw new Error("Не выбран датасет");

    const dashboardData: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'> = {
      name,
      description,
      datasetId: targetDatasetId,
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
    return addDashboard(dashboardData, targetDatasetId);
  }, [name, description, virtualMetrics, dashboardGroups, existingDashboardId, existingDashboard, addDashboard, updateDashboard, activeDatasetId]);
  
  // В выпадающий список добавления попадают только группы текущего датасета
  // (группы без datasetId — legacy — не скрываем, иначе их нельзя добавить
  // нигде). Полный список нужен MappingRow: дашборд мог содержать группу
  // другого датасета, её строка не должна ломаться.
  const targetDatasetId = activeDatasetId || existingDashboard?.datasetId;
  const availableGroups = useMemo(
    () => allGroups.filter(g => !g.datasetId || g.datasetId === targetDatasetId),
    [allGroups, targetDatasetId]
  );

  return {
    name, setName,
    description, setDescription,
    virtualMetrics, addVirtualMetric, removeVirtualMetric, reorderVirtualMetrics,
    updateVirtualMetricUnit,
    dashboardGroups, addGroupToDashboard, removeGroupFromDashboard,
    updateBinding,
    saveDashboard,
    availableGroups,
    allGroups,
  };
}
