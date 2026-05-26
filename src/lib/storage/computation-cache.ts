import { get, set, del, clear as clearDB } from 'idb-keyval';
import type { IComputationCache, CacheKey, CachedComputationEntry, CacheMetadata } from './types';
import { DashboardComputationResult } from '@/entities/metric';


const FILE_TTL = 24 * 60 * 60 * 1000;
const PG_TTL = 5 * 60 * 1000;

export class FileComputationCache implements IComputationCache {
  private prefix = 'comp:file:';

  async set(key: CacheKey, result: DashboardComputationResult, ttlMs = FILE_TTL): Promise<void> {
    const storageKey = `${this.prefix}${key.datasetId}:${key.dashboardId}:${key.filtersHash}${key.configHash ? `:${key.configHash}` : ''}`;
    const meta: CacheMetadata = {
      storedAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
      sourceType: 'file',
      recordCount: result.totalRecords,
    };
    try {
      await set(storageKey, { result, meta });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'QuotaExceededError') {
        console.warn('[FileCache] Quota exceeded. Clearing expired entries...');
        await this.clear(key.datasetId);
      } else {
        console.error('[FileCache] Persistence error:', err);
      }
    }
  }

  async get(key: CacheKey): Promise<CachedComputationEntry | null> {
    const storageKey = `${this.prefix}${key.datasetId}:${key.dashboardId}:${key.filtersHash}${key.configHash ? `:${key.configHash}` : ''}`;
    const entry = await get(storageKey);
    if (!entry) return null;
    if (Date.now() > entry.meta.expiresAt) {
      await this.invalidate(key);
      return null;
    }
    return entry as CachedComputationEntry;
  }

  async invalidate(key: CacheKey): Promise<void> {
    const storageKey = `${this.prefix}${key.datasetId}:${key.dashboardId}:${key.filtersHash}${key.configHash ? `:${key.configHash}` : ''}`;
    await del(storageKey);
  }

  async clear(datasetId?: string): Promise<void> {
    if (!datasetId) {
      await clearDB();
    } else {
      await set(`comp:file:invalidated:${datasetId}`, Date.now());
    }
  }

  async clearByDashboard(datasetId: string, dashboardId: string): Promise<void> {
    await set(`comp:file:invalidated:${datasetId}:${dashboardId}`, Date.now());
  }
}

export class PgComputationCache implements IComputationCache {
  private prefix = 'comp:pg:';
  private memoryStore = new Map<string, CachedComputationEntry>();

  async set(key: CacheKey, result: DashboardComputationResult, ttlMs = PG_TTL): Promise<void> {
    const storageKey = `${this.prefix}${key.datasetId}:${key.dashboardId}:${key.filtersHash}`;
    const meta: CacheMetadata = {
      storedAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
      sourceType: 'postgres',
      recordCount: result.totalRecords,
    };
    const entry = { result, meta };
    this.memoryStore.set(storageKey, entry);
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(entry));
    } catch {
      // Fallback to memory-only if sessionStorage quota exceeded
    }
  }

  async get(key: CacheKey): Promise<CachedComputationEntry | null> {
    const storageKey = `${this.prefix}${key.datasetId}:${key.dashboardId}:${key.filtersHash}`;
    const raw = sessionStorage.getItem(storageKey) || this.memoryStore.get(storageKey);
    if (!raw) return null;
    
    const entry: CachedComputationEntry = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Date.now() > entry.meta.expiresAt) {
      await this.invalidate(key);
      return null;
    }

    const invalidatedAt = await get(`comp:file:invalidated:${key.datasetId}:${key.dashboardId}`) as number | undefined;
    if (invalidatedAt && entry.meta.storedAt < invalidatedAt) {
      await this.invalidate(key);
      return null;
    }
    
    return entry;
  }

  async invalidate(key: CacheKey): Promise<void> {
    const storageKey = `${this.prefix}${key.datasetId}:${key.dashboardId}:${key.filtersHash}`;
    sessionStorage.removeItem(storageKey);
    this.memoryStore.delete(storageKey);
  }

  async clear(): Promise<void> {
    this.memoryStore.clear();
    sessionStorage.clear();
  }

  async clearByDashboard(datasetId: string, dashboardId: string): Promise<void> {
    const prefix = `${this.prefix}${datasetId}:${dashboardId}:`;
    for (const key of this.memoryStore.keys()) {
      if (key.startsWith(prefix)) this.memoryStore.delete(key);
    }
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(prefix)) sessionStorage.removeItem(k);
    }
  }
}

export function createComputationCache(sourceType: 'file' | 'postgres'): IComputationCache {
  return sourceType === 'file' ? new FileComputationCache() : new PgComputationCache();
}