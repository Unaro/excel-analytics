// lib/stores/computed-metrics-store.ts
import { create } from 'zustand';
import type {
  DashboardComputationResult,
  GroupComputationResult,
  ComputedMetricValue,
  MetricCache,
  HierarchyFilterValue,
} from '@/types';

interface ComputedMetricsState {
  // Кеш результатов вычислений
  dashboardResults: Map<string, DashboardComputationResult>;
  metricCache: Map<string, MetricCache>;
  
  // Состояние загрузки
  isComputing: boolean;
  computationError: string | null;
  
  // Действия
  setDashboardResult: (dashboardId: string, result: DashboardComputationResult) => void;
  clearDashboardResult: (dashboardId: string) => void;
  clearAllResults: () => void;
  
  // Кеш метрик
  cacheMetricValue: (key: string, value: ComputedMetricValue, ttl?: number) => void;
  getCachedMetricValue: (key: string) => ComputedMetricValue | null;
  invalidateCache: (pattern?: string) => void;
  clearExpiredCache: () => void;
  
  // Вычисления
  setComputingState: (isComputing: boolean, error?: string | null) => void;
  
  // Геттеры
  getDashboardResult: (dashboardId: string) => DashboardComputationResult | undefined;
  getGroupResult: (dashboardId: string, groupId: string) => GroupComputationResult | undefined;
  getCacheStats: () => { size: number; expired: number };
}

/**
 * Генерация ключа кеша для метрики
 */
function generateCacheKey(
  dashboardId: string,
  groupId: string,
  metricId: string,
  filters: HierarchyFilterValue[]
): string {
  const filterKey = filters
    .map((f) => `${f.levelId}:${f.value}`)
    .join('|');
  return `${dashboardId}:${groupId}:${metricId}:${filterKey}`;
}

export const useComputedMetricsStore = create<ComputedMetricsState>((set, get) => ({
  dashboardResults: new Map(),
  metricCache: new Map(),
  isComputing: false,
  computationError: null,
  
  setDashboardResult: (dashboardId, result) => {
    set((state) => {
      const newResults = new Map(state.dashboardResults);
      newResults.set(dashboardId, result);
      return { dashboardResults: newResults };
    });
  },
  
  clearDashboardResult: (dashboardId) => {
    set((state) => {
      const newResults = new Map(state.dashboardResults);
      newResults.delete(dashboardId);
      return { dashboardResults: newResults };
    });
  },
  
  clearAllResults: () => {
    set({ dashboardResults: new Map(), metricCache: new Map() });
  },
  
  cacheMetricValue: (key, value, ttl = 300000) => {
    // ttl по умолчанию 5 минут
    set((state) => {
      const newCache = new Map(state.metricCache);
      newCache.set(key, {
        key,
        value,
        expiresAt: Date.now() + ttl,
      });
      return { metricCache: newCache };
    });
  },
  
  getCachedMetricValue: (key) => {
    const cache = get().metricCache.get(key);
    if (!cache) return null;
    
    // Проверяем, не истек ли кеш
    if (cache.expiresAt < Date.now()) {
      // Удаляем истекший кеш
      set((state) => {
        const newCache = new Map(state.metricCache);
        newCache.delete(key);
        return { metricCache: newCache };
      });
      return null;
    }
    
    return cache.value;
  },
  
  invalidateCache: (pattern) => {
    set((state) => {
      if (!pattern) {
        // Очистить весь кеш
        return { metricCache: new Map() };
      }
      
      // Очистить кеш по паттерну
      const newCache = new Map(state.metricCache);
      for (const key of newCache.keys()) {
        if (key.includes(pattern)) {
          newCache.delete(key);
        }
      }
      return { metricCache: newCache };
    });
  },
  
  clearExpiredCache: () => {
    const now = Date.now();
    set((state) => {
      const newCache = new Map(state.metricCache);
      for (const [key, cache] of newCache.entries()) {
        if (cache.expiresAt < now) {
          newCache.delete(key);
        }
      }
      return { metricCache: newCache };
    });
  },
  
  setComputingState: (isComputing, error = null) => {
    set({ isComputing, computationError: error });
  },
  
  getDashboardResult: (dashboardId) => {
    return get().dashboardResults.get(dashboardId);
  },
  
  getGroupResult: (dashboardId, groupId) => {
    const result = get().getDashboardResult(dashboardId);
    if (!result) return undefined;
    return result.groups.find((g) => g.groupId === groupId);
  },
  
  getCacheStats: () => {
    const cache = get().metricCache;
    const now = Date.now();
    let expired = 0;
    
    for (const entry of cache.values()) {
      if (entry.expiresAt < now) {
        expired++;
      }
    }
    
    return {
      size: cache.size,
      expired,
    };
  },
}));

// Экспорт утилиты для генерации ключей кеша
export { generateCacheKey };
