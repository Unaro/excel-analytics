import { logger } from '@/shared/lib/logger';
import { get, set, del, clear as clearDB } from 'idb-keyval';
import type {
  IComputationCache,
  CacheKey,
  CachedComputationEntry,
} from './types';
import type { DashboardComputationResult } from '@/shared/lib/types/computation';

const FILE_TTL = 24 * 60 * 60 * 1000;
const PG_TTL = 5 * 60 * 1000;

/** Собирает ключ хранения из составного CacheKey. */
function buildStorageKey(prefix: string, key: CacheKey): string {
  return `${prefix}${key.datasetId}:${key.dashboardId}:${key.filtersHash}`;
}

/**
 * Удаляет из sessionStorage все ключи с данным префиксом.
 *
 * Ключи сначала собираются, потом удаляются: removeItem внутри цикла
 * по индексам сдвигает нумерацию и пропускает элементы.
 */
function removeSessionKeysByPrefix(prefix: string): void {
  const keys: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    if (k && k.startsWith(prefix)) keys.push(k);
  }
  keys.forEach((k) => sessionStorage.removeItem(k));
}

/**
 * Кэш результатов вычислений для file-источников (DuckDB-WASM).
 *
 * Уровни: память → sessionStorage → IndexedDB.
 * Большие результаты, не влезающие в sessionStorage (~5 МБ квота),
 * прозрачно уходят в IndexedDB — раньше переполнение глоталось
 * молча и кэш деградировал в memory-only без сигнала (п.9 аудита).
 */
export class FileComputationCache implements IComputationCache {
  private prefix = 'comp:file:';
  private memoryStore = new Map<string, CachedComputationEntry>();

  async set(
    key: CacheKey,
    result: DashboardComputationResult,
    ttlMs = FILE_TTL
  ): Promise<void> {
    const storageKey = buildStorageKey(this.prefix, key);
    const meta = {
      storedAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
      sourceType: 'file' as const,
      recordCount: result.totalRecords,
    };
    const entry: CachedComputationEntry = { result, meta };
    this.memoryStore.set(storageKey, entry);
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(entry));
    } catch (err) {
      // Квота sessionStorage исчерпана — переносим запись в IndexedDB,
      // чтобы кэш переживал перезагрузку страницы.
      logger.warn(
        '[computation-cache] sessionStorage переполнен, результат уходит в IndexedDB:',
        err
      );
      try {
        await set(storageKey, entry);
      } catch (idbErr) {
        logger.warn('[computation-cache] IndexedDB fallback не удался:', idbErr);
      }
    }
  }

  async get(key: CacheKey): Promise<CachedComputationEntry | null> {
    const storageKey = buildStorageKey(this.prefix, key);
    const raw =
      sessionStorage.getItem(storageKey) ??
      this.memoryStore.get(storageKey) ??
      ((await get(storageKey)) as CachedComputationEntry | undefined) ??
      null;
    if (!raw) return null;

    let entry: CachedComputationEntry;
    if (typeof raw === 'string') {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (!isCachedComputationEntry(parsed)) return null;
        entry = parsed;
      } catch {
        return null;
      }
    } else {
      entry = raw;
    }

    if (Date.now() > entry.meta.expiresAt) {
      await this.invalidate(key);
      return null;
    }

    // 1. Глобальная инвалидация датасета (вызывается cache.clear(datasetId))
    const globalInvalidatedAt = (await get(
      `comp:file:invalidated:${key.datasetId}`
    )) as number | undefined;

    // 2. Инвалидация конкретного дашборда (вызывается cache.clearByDashboard)
    const dashboardInvalidatedAt = (await get(
      `comp:file:invalidated:${key.datasetId}:${key.dashboardId}`
    )) as number | undefined;

    const invalidatedAt = Math.max(globalInvalidatedAt ?? 0, dashboardInvalidatedAt ?? 0);

    if (invalidatedAt > 0 && entry.meta.storedAt < invalidatedAt) {
      await this.invalidate(key);
      return null;
    }

    return entry;
  }

  async invalidate(key: CacheKey): Promise<void> {
    const storageKey = `${buildStorageKey(this.prefix, key)}${
      key.configHash ? `:${key.configHash}` : ''
    }`;
    sessionStorage.removeItem(storageKey);
    this.memoryStore.delete(storageKey);
    await del(storageKey);
  }

  async clear(datasetId?: string): Promise<void> {
    if (!datasetId) {
      await clearDB();
    } else {
      await set(`comp:file:invalidated:${datasetId}`, Date.now());
    }
  }

  async clearByDashboard(
    datasetId: string,
    dashboardId: string
  ): Promise<void> {
    await set(
      `comp:file:invalidated:${datasetId}:${dashboardId}`,
      Date.now()
    );
  }
}

/**
 * Кэш результатов вычислений для PostgreSQL-источников.
 *
 * Короткий TTL (5 минут): данные на сервере могут меняться.
 * Уровни: память → sessionStorage (без IndexedDB — записи короткоживущие).
 */
export class PgComputationCache implements IComputationCache {
  private prefix = 'comp:pg:';
  private memoryStore = new Map<string, CachedComputationEntry>();

  async set(
    key: CacheKey,
    result: DashboardComputationResult,
    ttlMs = PG_TTL
  ): Promise<void> {
    const storageKey = buildStorageKey(this.prefix, key);
    const meta = {
      storedAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
      sourceType: 'postgres' as const,
      recordCount: result.totalRecords,
    };
    const entry: CachedComputationEntry = { result, meta };
    this.memoryStore.set(storageKey, entry);
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(entry));
    } catch (err) {
      // Короткоживущая запись — memory-only достаточно, но сигналим.
      logger.warn('[computation-cache] sessionStorage переполнен (pg):', err);
    }
  }

  async get(key: CacheKey): Promise<CachedComputationEntry | null> {
    const storageKey = buildStorageKey(this.prefix, key);
    const raw =
      sessionStorage.getItem(storageKey) || this.memoryStore.get(storageKey);
    if (!raw) return null;

    let entry: CachedComputationEntry;
    if (typeof raw === 'string') {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (!isCachedComputationEntry(parsed)) return null;
        entry = parsed;
      } catch {
        return null;
      }
    } else {
      entry = raw;
    }

    if (Date.now() > entry.meta.expiresAt) {
      await this.invalidate(key);
      return null;
    }
    return entry;
  }

  async invalidate(key: CacheKey): Promise<void> {
    const storageKey = buildStorageKey(this.prefix, key);
    sessionStorage.removeItem(storageKey);
    this.memoryStore.delete(storageKey);
  }

  /**
   * Чистит ТОЛЬКО записи этого кэша.
   *
   * Раньше вызывался sessionStorage.clear(), который сносил весь
   * sessionStorage приложения (включая чужие ключи) — исправлено.
   */
  async clear(): Promise<void> {
    this.memoryStore.clear();
    removeSessionKeysByPrefix(this.prefix);
  }

  async clearByDashboard(
    datasetId: string,
    dashboardId: string
  ): Promise<void> {
    const prefix = `${this.prefix}${datasetId}:${dashboardId}:`;
    for (const key of Array.from(this.memoryStore.keys())) {
      if (key.startsWith(prefix)) this.memoryStore.delete(key);
    }
    removeSessionKeysByPrefix(prefix);
  }
}

/**
 * Фабрика кэша по типу источника данных.
 */
export function createComputationCache(
  sourceType: 'file' | 'postgres'
): IComputationCache {
  return sourceType === 'file'
    ? new FileComputationCache()
    : new PgComputationCache();
}

/** Type guard валидности записи кэша после JSON.parse. */
function isCachedComputationEntry(value: unknown): value is CachedComputationEntry {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.result === 'object' &&
    obj.result !== null &&
    typeof obj.meta === 'object' &&
    obj.meta !== null &&
    typeof (obj.meta as Record<string, unknown>).storedAt === 'number' &&
    typeof (obj.meta as Record<string, unknown>).expiresAt === 'number'
  );
}
