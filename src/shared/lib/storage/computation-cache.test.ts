import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DashboardComputationResult } from '@/shared/lib/types/computation';
import type { CacheKey } from './types';

// ─── Мок idb-keyval: in-memory карта вместо IndexedDB ────────
const idbStore = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: vi.fn(async (k: string) => idbStore.get(k)),
  set: vi.fn(async (k: string, v: unknown) => void idbStore.set(k, v)),
  del: vi.fn(async (k: string) => void idbStore.delete(k)),
  clear: vi.fn(async () => idbStore.clear()),
}));

// ─── Мок sessionStorage (env=node его не имеет) ──────────────
class MemorySessionStorage {
  private map = new Map<string, string>();
  quotaExceeded = false;

  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    if (this.quotaExceeded) throw new DOMException('Quota', 'QuotaExceededError');
    this.map.set(k, v);
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
  clear(): void {
    this.map.clear();
  }
  key(i: number): string | null {
    return Array.from(this.map.keys())[i] ?? null;
  }
  get length(): number {
    return this.map.size;
  }
}

const sessionMock = new MemorySessionStorage();
vi.stubGlobal('sessionStorage', sessionMock);

const { FileComputationCache, PgComputationCache } = await import(
  './computation-cache'
);

const key: CacheKey = {
  datasetId: 'ds1',
  dashboardId: 'db1',
  filtersHash: 'h1',
};

const result = {
  dashboardId: 'db1',
  totalRecords: 42,
  groups: [],
  virtualMetrics: [],
  hierarchyFilters: [],
  activeFilter: null,
  computedAt: Date.now(),
  computationTime: 1,
} as unknown as DashboardComputationResult;

beforeEach(() => {
  idbStore.clear();
  sessionMock.clear();
  sessionMock.quotaExceeded = false;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('FileComputationCache', () => {
  it('set помечает запись sourceType: file (п.8 аудита — была копипаста postgres)', async () => {
    const cache = new FileComputationCache();
    await cache.set(key, result);
    const entry = await cache.get(key);

    expect(entry?.meta.sourceType).toBe('file');
  });

  it('записи переживают «перезагрузку» через sessionStorage', async () => {
    const cache = new FileComputationCache();
    await cache.set(key, result);

    const fresh = new FileComputationCache(); // новая «вкладка», память пуста
    const entry = await fresh.get(key);
    expect(entry?.result.totalRecords).toBe(42);
  });

  it('при переполнении sessionStorage результат уходит в IndexedDB', async () => {
    sessionMock.quotaExceeded = true;
    const cache = new FileComputationCache();
    await cache.set(key, result);

    const fresh = new FileComputationCache();
    const entry = await fresh.get(key);
    expect(entry?.result.totalRecords).toBe(42);
    expect(idbStore.size).toBeGreaterThan(0);
  });

  it('истёкший TTL → null и инвалидация', async () => {
    const cache = new FileComputationCache();
    await cache.set(key, result, -1); // уже истёк

    expect(await cache.get(key)).toBeNull();
  });

  it('clear(datasetId) инвалидирует ранее записанные результаты', async () => {
    const cache = new FileComputationCache();
    await cache.set(key, result);
    await new Promise((r) => setTimeout(r, 2)); // invalidatedAt > storedAt
    await cache.clear('ds1');

    expect(await cache.get(key)).toBeNull();
  });

  it('clearByDashboard инвалидирует только указанный дашборд', async () => {
    const cache = new FileComputationCache();
    const otherKey: CacheKey = { ...key, dashboardId: 'db2' };
    await cache.set(key, result);
    await cache.set(otherKey, result);
    await new Promise((r) => setTimeout(r, 2));
    await cache.clearByDashboard('ds1', 'db1');

    expect(await cache.get(key)).toBeNull();
    expect(await cache.get(otherKey)).not.toBeNull();
  });
});

describe('PgComputationCache', () => {
  it('set помечает запись sourceType: postgres', async () => {
    const cache = new PgComputationCache();
    await cache.set(key, result);

    expect((await cache.get(key))?.meta.sourceType).toBe('postgres');
  });

  it('clear() не трогает чужие ключи sessionStorage', async () => {
    sessionStorage.setItem('app:unrelated', 'value');
    const cache = new PgComputationCache();
    await cache.set(key, result);
    await cache.clear();

    expect(await cache.get(key)).toBeNull();
    expect(sessionStorage.getItem('app:unrelated')).toBe('value');
  });

  it('clearByDashboard удаляет все записи дашборда (включая разные фильтры)', async () => {
    const cache = new PgComputationCache();
    await cache.set(key, result);
    await cache.set({ ...key, filtersHash: 'h2' }, result);
    await cache.set({ ...key, dashboardId: 'db2' }, result);
    await cache.clearByDashboard('ds1', 'db1');

    expect(await cache.get(key)).toBeNull();
    expect(await cache.get({ ...key, filtersHash: 'h2' })).toBeNull();
    expect(await cache.get({ ...key, dashboardId: 'db2' })).not.toBeNull();
  });

  it('повреждённый JSON в sessionStorage → null, без исключения', async () => {
    sessionStorage.setItem('comp:pg:ds1:db1:h1', '{битый json');
    const cache = new PgComputationCache();

    expect(await cache.get(key)).toBeNull();
  });
});
