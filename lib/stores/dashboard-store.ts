// lib/stores/dashboard-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import type {
  Dashboard,
  DashboardWidget,
  VirtualMetric,
  HierarchyFilterValue,
  IndicatorGroupInDashboard,
} from '@/types';

interface DashboardState {
  dashboards: Dashboard[];
  activeDashboardId: string | null;
  
  // Действия с дашбордами
  addDashboard: (dashboard: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateDashboard: (id: string, updates: Partial<Omit<Dashboard, 'id' | 'createdAt'>>) => void;
  deleteDashboard: (id: string) => void;
  duplicateDashboard: (id: string) => string | null;
  setActiveDashboard: (id: string | null) => void;
  
  // Действия с виртуальными метриками
  addVirtualMetric: (dashboardId: string, metric: Omit<VirtualMetric, 'id'>) => void;
  updateVirtualMetric: (dashboardId: string, metricId: string, updates: Partial<VirtualMetric>) => void;
  deleteVirtualMetric: (dashboardId: string, metricId: string) => void;
  reorderVirtualMetrics: (dashboardId: string, metricIds: string[]) => void;
  
  // Действия с иерархическими фильтрами
  setHierarchyFilters: (dashboardId: string, filters: HierarchyFilterValue[]) => void;
  addHierarchyFilter: (dashboardId: string, filter: HierarchyFilterValue) => void;
  updateHierarchyFilter: (dashboardId: string, levelId: string, value: string) => void;
  removeHierarchyFilter: (dashboardId: string, levelId: string) => void;
  clearHierarchyFilters: (dashboardId: string) => void;
  
  // Действия с группами показателей в дашборде
  addIndicatorGroup: (dashboardId: string, groupId: string) => void;
  removeIndicatorGroup: (dashboardId: string, groupId: string) => void;
  toggleIndicatorGroup: (dashboardId: string, groupId: string, enabled: boolean) => void;
  reorderIndicatorGroups: (dashboardId: string, groupIds: string[]) => void;
  
  // ВАЖНОЕ ОБНОВЛЕНИЕ: Обновление привязки метрики
  updateVirtualMetricBinding: (dashboardId: string, groupId: string, virtualMetricId: string, metricId: string) => void;
  
  // Действия с виджетами
  addWidget: (dashboardId: string, widget: Omit<DashboardWidget, 'id'>) => string;
  updateWidget: (dashboardId: string, widgetId: string, updates: Partial<DashboardWidget>) => void;
  deleteWidget: (dashboardId: string, widgetId: string) => void;
  duplicateWidget: (dashboardId: string, widgetId: string) => string | null;
  
  // Геттеры
  getDashboard: (id: string) => Dashboard | undefined;
  getActiveDashboard: () => Dashboard | undefined;
  getAllDashboards: () => Dashboard[];
  getWidget: (dashboardId: string, widgetId: string) => DashboardWidget | undefined;
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      dashboards: [],
      activeDashboardId: null,
      
      // --- Дашборды ---
      addDashboard: (dashboard) => {
        const id = nanoid();
        const now = Date.now();
        
        set((state) => ({
          dashboards: [
            ...state.dashboards,
            {
              ...dashboard,
              id,
              createdAt: now,
              updatedAt: now,
            },
          ],
        }));
        
        return id;
      },
      
      updateDashboard: (id, updates) => {
        set((state) => ({
          dashboards: state.dashboards.map((dashboard) =>
            dashboard.id === id
              ? { ...dashboard, ...updates, updatedAt: Date.now() }
              : dashboard
          ),
        }));
      },
      
      deleteDashboard: (id) => {
        set((state) => ({
          dashboards: state.dashboards.filter((dashboard) => dashboard.id !== id),
          activeDashboardId: state.activeDashboardId === id ? null : state.activeDashboardId,
        }));
      },
      
      duplicateDashboard: (id) => {
        const dashboard = get().getDashboard(id);
        if (!dashboard) return null;
        
        const newId = nanoid();
        const now = Date.now();
        
        // Генерируем новые ID для виджетов
        const newWidgets = dashboard.widgets.map((widget) => ({
          ...widget,
          id: nanoid(),
        }));
        
        set((state) => ({
          dashboards: [
            ...state.dashboards,
            {
              ...dashboard,
              id: newId,
              name: `${dashboard.name} (копия)`,
              widgets: newWidgets,
              createdAt: now,
              updatedAt: now,
            },
          ],
        }));
        
        return newId;
      },
      
      setActiveDashboard: (id) => {
        set({ activeDashboardId: id });
      },
      
      // --- Виртуальные метрики ---
      addVirtualMetric: (dashboardId, metric) => {
        const id = nanoid();
        set((state) => ({
          dashboards: state.dashboards.map((dashboard) =>
            dashboard.id === dashboardId
              ? {
                  ...dashboard,
                  virtualMetrics: [...dashboard.virtualMetrics, { ...metric, id }],
                  updatedAt: Date.now(),
                }
              : dashboard
          ),
        }));
      },
      
      updateVirtualMetric: (dashboardId, metricId, updates) => {
        set((state) => ({
          dashboards: state.dashboards.map((dashboard) =>
            dashboard.id === dashboardId
              ? {
                  ...dashboard,
                  virtualMetrics: dashboard.virtualMetrics.map((metric) =>
                    metric.id === metricId ? { ...metric, ...updates } : metric
                  ),
                  updatedAt: Date.now(),
                }
              : dashboard
          ),
        }));
      },
      
      deleteVirtualMetric: (dashboardId, metricId) => {
        set((state) => ({
          dashboards: state.dashboards.map((dashboard) =>
            dashboard.id === dashboardId
              ? {
                  ...dashboard,
                  virtualMetrics: dashboard.virtualMetrics.filter(
                    (metric) => metric.id !== metricId
                  ),
                  updatedAt: Date.now(),
                }
              : dashboard
          ),
        }));
      },
      
      reorderVirtualMetrics: (dashboardId, metricIds) => {
        set((state) => ({
          dashboards: state.dashboards.map((dashboard) => {
            if (dashboard.id !== dashboardId) return dashboard;
            
            const reordered = metricIds.map((id, index) => {
              const metric = dashboard.virtualMetrics.find((m) => m.id === id);
              return metric ? { ...metric, order: index } : null;
            }).filter((m): m is VirtualMetric => m !== null);
            
            return {
              ...dashboard,
              virtualMetrics: reordered,
              updatedAt: Date.now(),
            };
          }),
        }));
      },
      
      // --- Иерархические фильтры ---
      setHierarchyFilters: (dashboardId, filters) => {
        set((state) => ({
          dashboards: state.dashboards.map((dashboard) =>
            dashboard.id === dashboardId
              ? {
                  ...dashboard,
                  hierarchyFilters: filters,
                  updatedAt: Date.now(),
                }
              : dashboard
          ),
        }));
      },
      
      addHierarchyFilter: (dashboardId, filter) => {
        set((state) => ({
          dashboards: state.dashboards.map((dashboard) => {
            if (dashboard.id !== dashboardId) return dashboard;
            
            const existingIndex = dashboard.hierarchyFilters.findIndex(
              (f) => f.levelId === filter.levelId
            );
            
            let newFilters: HierarchyFilterValue[];
            
            if (existingIndex >= 0) {
              newFilters = dashboard.hierarchyFilters
                .slice(0, existingIndex)
                .concat(filter);
            } else {
              newFilters = [...dashboard.hierarchyFilters, filter];
            }
            
            newFilters.sort((a, b) => a.levelIndex - b.levelIndex);
            
            return {
              ...dashboard,
              hierarchyFilters: newFilters,
              updatedAt: Date.now(),
            };
          }),
        }));
      },
      
      updateHierarchyFilter: (dashboardId, levelId, value) => {
        set((state) => ({
          dashboards: state.dashboards.map((dashboard) => {
            if (dashboard.id !== dashboardId) return dashboard;
            
            const filterIndex = dashboard.hierarchyFilters.findIndex(
              (f) => f.levelId === levelId
            );
            
            if (filterIndex < 0) return dashboard;
            
            const newFilters = dashboard.hierarchyFilters
              .slice(0, filterIndex + 1)
              .map((f, idx) =>
                idx === filterIndex ? { ...f, value } : f
              );
            
            return {
              ...dashboard,
              hierarchyFilters: newFilters,
              updatedAt: Date.now(),
            };
          }),
        }));
      },
      
      removeHierarchyFilter: (dashboardId, levelId) => {
        set((state) => ({
          dashboards: state.dashboards.map((dashboard) => {
            if (dashboard.id !== dashboardId) return dashboard;
            
            const filterIndex = dashboard.hierarchyFilters.findIndex(
              (f) => f.levelId === levelId
            );
            
            if (filterIndex < 0) return dashboard;
            
            const newFilters = dashboard.hierarchyFilters.slice(0, filterIndex);
            
            return {
              ...dashboard,
              hierarchyFilters: newFilters,
              updatedAt: Date.now(),
            };
          }),
        }));
      },
      
      clearHierarchyFilters: (dashboardId) => {
        set((state) => ({
          dashboards: state.dashboards.map((dashboard) =>
            dashboard.id === dashboardId
              ? {
                  ...dashboard,
                  hierarchyFilters: [],
                  updatedAt: Date.now(),
                }
              : dashboard
          ),
        }));
      },
      
      // --- Группы показателей ---
      addIndicatorGroup: (dashboardId, groupId) => {
        set((state) => ({
          dashboards: state.dashboards.map((dashboard) => {
            if (dashboard.id !== dashboardId) return dashboard;
            if (dashboard.indicatorGroups.some((g) => g.groupId === groupId)) {
              return dashboard;
            }
            const order = dashboard.indicatorGroups.length;
            return {
              ...dashboard,
              indicatorGroups: [
                ...dashboard.indicatorGroups,
                {
                  groupId,
                  enabled: true,
                  order,
                  virtualMetricBindings: [], // Инициализируем пустым массивом
                },
              ],
              updatedAt: Date.now(),
            };
          }),
        }));
      },
      
      removeIndicatorGroup: (dashboardId, groupId) => {
        set((state) => ({
          dashboards: state.dashboards.map((dashboard) =>
            dashboard.id === dashboardId
              ? {
                  ...dashboard,
                  indicatorGroups: dashboard.indicatorGroups
                    .filter((g) => g.groupId !== groupId)
                    .map((g, idx) => ({ ...g, order: idx })),
                  updatedAt: Date.now(),
                }
              : dashboard
          ),
        }));
      },
      
      toggleIndicatorGroup: (dashboardId, groupId, enabled) => {
        set((state) => ({
          dashboards: state.dashboards.map((dashboard) =>
            dashboard.id === dashboardId
              ? {
                  ...dashboard,
                  indicatorGroups: dashboard.indicatorGroups.map((g) =>
                    g.groupId === groupId ? { ...g, enabled } : g
                  ),
                  updatedAt: Date.now(),
                }
              : dashboard
          ),
        }));
      },
      
      reorderIndicatorGroups: (dashboardId, groupIds) => {
        set((state) => ({
          dashboards: state.dashboards.map((dashboard) => {
            if (dashboard.id !== dashboardId) return dashboard;
            
            const reordered = groupIds
              .map((id, index) => {
                const group = dashboard.indicatorGroups.find((g) => g.groupId === id);
                return group ? { ...group, order: index } : null;
              })
              .filter((g): g is IndicatorGroupInDashboard => g !== null);
            
            return {
              ...dashboard,
              indicatorGroups: reordered,
              updatedAt: Date.now(),
            };
          }),
        }));
      },
      
      updateVirtualMetricBinding: (dashboardId, groupId, virtualMetricId, metricId) => {
        set((state) => ({
          dashboards: state.dashboards.map((dashboard) => {
            if (dashboard.id !== dashboardId) return dashboard;
            
            return {
              ...dashboard,
              indicatorGroups: dashboard.indicatorGroups.map((group) => {
                if (group.groupId !== groupId) return group;
                
                const bindings = group.virtualMetricBindings || [];
                const existingIdx = bindings.findIndex(b => b.virtualMetricId === virtualMetricId);
                
                let newBindings;
                if (existingIdx >= 0) {
                  // Обновляем существующую привязку
                  newBindings = [...bindings];
                  newBindings[existingIdx] = { virtualMetricId, metricId };
                } else {
                  // Добавляем новую
                  newBindings = [...bindings, { virtualMetricId, metricId }];
                }
                
                return { ...group, virtualMetricBindings: newBindings };
              }),
              updatedAt: Date.now(),
            };
          }),
        }));
      },
      
      // --- Виджеты ---
      addWidget: (dashboardId, widget) => {
        const id = nanoid();
        set((state) => ({
          dashboards: state.dashboards.map((dashboard) =>
            dashboard.id === dashboardId
              ? {
                  ...dashboard,
                  widgets: [...dashboard.widgets, { ...widget, id }],
                  updatedAt: Date.now(),
                }
              : dashboard
          ),
        }));
        return id;
      },
      
      updateWidget: (dashboardId, widgetId, updates) => {
        set((state) => ({
          dashboards: state.dashboards.map((dashboard) =>
            dashboard.id === dashboardId
              ? {
                  ...dashboard,
                  widgets: dashboard.widgets.map((widget) =>
                    widget.id === widgetId ? { ...widget, ...updates } : widget
                  ),
                  updatedAt: Date.now(),
                }
              : dashboard
          ),
        }));
      },
      
      deleteWidget: (dashboardId, widgetId) => {
        set((state) => ({
          dashboards: state.dashboards.map((dashboard) =>
            dashboard.id === dashboardId
              ? {
                  ...dashboard,
                  widgets: dashboard.widgets.filter((widget) => widget.id !== widgetId),
                  updatedAt: Date.now(),
                }
              : dashboard
          ),
        }));
      },
      
      duplicateWidget: (dashboardId, widgetId) => {
        const dashboard = get().getDashboard(dashboardId);
        if (!dashboard) return null;
        
        const widget = dashboard.widgets.find((w) => w.id === widgetId);
        if (!widget) return null;
        
        const newId = nanoid();
        
        set((state) => ({
          dashboards: state.dashboards.map((d) =>
            d.id === dashboardId
              ? {
                  ...d,
                  widgets: [
                    ...d.widgets,
                    {
                      ...widget,
                      id: newId,
                      title: `${widget.title} (копия)`,
                      position: {
                        ...widget.position,
                        x: widget.position.x + 1,
                        y: widget.position.y + 1,
                      },
                    },
                  ],
                  updatedAt: Date.now(),
                }
              : d
          ),
        }));
        
        return newId;
      },
      
      // --- Геттеры ---
      getDashboard: (id) => {
        return get().dashboards.find((dashboard) => dashboard.id === id);
      },
      
      getActiveDashboard: () => {
        const { activeDashboardId, dashboards } = get();
        if (!activeDashboardId) return undefined;
        return dashboards.find((d) => d.id === activeDashboardId);
      },
      
      getAllDashboards: () => {
        return get().dashboards;
      },
      
      getWidget: (dashboardId, widgetId) => {
        const dashboard = get().getDashboard(dashboardId);
        if (!dashboard) return undefined;
        return dashboard.widgets.find((w) => w.id === widgetId);
      },
    }),
    {
      name: 'dashboard-storage',
      version: 2, // Обновляем версию из-за изменений в структуре данных
    }
  )
);