'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { nanoid } from 'nanoid';
import { useIndicatorGroupStore } from '@/entities/indicator-group';
import { useMetricTemplateStore } from '@/entities/metric';
import { useDatasetStore } from '@/entities/dataset';
import { IndicatorGroupInDashboard, MetricTemplate, DashboardColumn, VirtualMetricBindingInDashboard } from '@/shared/lib/validators';
import { useDashboardStore } from '@/entities/dashboard';
import { Dashboard } from '@/entities/dashboard';
import { resolveColumnTemplateId } from '@/shared/lib/utils/dashboard-columns';

export function useDashboardBuilder(existingDashboardId?: string) {
  // Сначала ВСЕ хуки — никаких условий до useState.
  // Экшены стора стабильны — подписываемся точечно, а не на весь стор:
  // useDashboardStore() без селектора ререндерил форму билдера на любое
  // изменение любого дашборда (п.7 аудита ядра).
  const addDashboard = useDashboardStore(s => s.addDashboard);
  const updateDashboard = useDashboardStore(s => s.updateDashboard);
  const getDashboard = useDashboardStore(s => s.getDashboard);
  const allGroups = useIndicatorGroupStore(s => s.groups);
  const templates = useMetricTemplateStore(s => s.templates);
  const activeDatasetId = useDatasetStore(s => s.activeDatasetId);
  
  // useState вызываются в фиксированном порядке — БЕЗ вычислений до них
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [virtualMetrics, setVirtualMetrics] = useState<DashboardColumn[]>([]);
  const [dashboardGroups, setDashboardGroups] = useState<IndicatorGroupInDashboard[]>([]);

  // Мемоизируем existingDashboard
  const existingDashboard = useMemo(
    () => (existingDashboardId ? getDashboard(existingDashboardId) : null),
    [existingDashboardId, getDashboard]
  );

  // Загрузка данных дашборда при монтировании. Старые колонки без
  // templateId лениво мигрируем: выводим шаблон из привязок — при
  // сохранении templateId запишется в колонку.
  useEffect(() => {
    if (existingDashboard) {
      setName(existingDashboard.name || '');
      setDescription(existingDashboard.description || '');
      const groupsCfg = existingDashboard.indicatorGroups || [];
      const groupsState = useIndicatorGroupStore.getState().groups;
      setVirtualMetrics(
        (existingDashboard.virtualMetrics || []).map(vm => ({
          ...vm,
          templateId: resolveColumnTemplateId(vm, groupsCfg, groupsState),
        }))
      );
      setDashboardGroups(groupsCfg);
    }
  }, [existingDashboard]);

  // Колонка дашборда = шаблон: формат/имя/единица берутся из него,
  // отдельно настраивать не нужно. Колонка хранит только templateId,
  // colorConfig (пороги задаются на дашборде) и order.
  const addColumn = useCallback((templateId: string) => {
    if (!templateId) return;
    setVirtualMetrics(prev => {
      if (prev.some(vm => vm.templateId === templateId)) return prev; // без дублей
      return [...prev, { id: nanoid(), templateId, order: prev.length }];
    });
  }, []);

  const removeVirtualMetric = useCallback((id: string) => {
    setVirtualMetrics(prev => prev.filter(vm => vm.id !== id));
  }, []);

  const reorderVirtualMetrics = useCallback((newOrder: DashboardColumn[]) => {
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

  // Шаблоны-кандидаты для колонок: те, что реально используются метриками
  // добавленных в дашборд групп (минус уже добавленные колонки).
  const availableTemplates = useMemo<MetricTemplate[]>(() => {
    const usedTemplateIds = new Set<string>();
    for (const cfg of dashboardGroups) {
      const group = allGroups.find(g => g.id === cfg.groupId);
      group?.metrics.forEach(m => usedTemplateIds.add(m.templateId));
    }
    const addedColumnTemplateIds = new Set(
      virtualMetrics.map(vm => vm.templateId).filter(Boolean)
    );
    return templates.filter(
      t => usedTemplateIds.has(t.id) && !addedColumnTemplateIds.has(t.id)
    );
  }, [dashboardGroups, allGroups, virtualMetrics, templates]);

  return {
    name, setName,
    description, setDescription,
    virtualMetrics, addColumn, removeVirtualMetric, reorderVirtualMetrics,
    dashboardGroups, addGroupToDashboard, removeGroupFromDashboard,
    updateBinding,
    saveDashboard,
    availableGroups,
    availableTemplates,
    templates,
    allGroups,
  };
}
