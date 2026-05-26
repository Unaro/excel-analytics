import { DashboardComputationResult } from "@/entities/metric";

export interface CacheKey {
  datasetId: string;
  dashboardId: string;
  filtersHash: string;
  configHash?: string;
}

export interface CacheMetadata {
  storedAt: number;
  expiresAt: number;
  sourceType: 'file' | 'postgres';
  recordCount: number;
}

export interface CachedComputationEntry {
  result: DashboardComputationResult;
  meta: CacheMetadata;
}

export interface IComputationCache {
  set(key: CacheKey, result: DashboardComputationResult, ttlMs?: number): Promise<void>;
  get(key: CacheKey): Promise<CachedComputationEntry | null>;
  invalidate(key: CacheKey): Promise<void>;
  clear(datasetId?: string): Promise<void>;
  clearByDashboard(datasetId: string, dashboardId: string): Promise<void>;
}