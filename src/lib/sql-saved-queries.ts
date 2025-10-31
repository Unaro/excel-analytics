// src/lib/sql-saved-queries.ts (исправленная версия)
import { SavedQuery, SavedQueryInput } from '@/types/sql';

const STORAGE_KEY = 'savedSQLQueries';

export const sqlSavedQueries = {
  load(): SavedQuery[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      
      const parsed = JSON.parse(raw) as SavedQuery[];
      // Мигрируем старые записи без lastUsed
      return parsed.map(q => ({
        ...q,
        lastUsed: q.lastUsed || q.createdAt, // fallback для старых записей
        usageCount: q.usageCount || 0,
      }));
    } catch {
      return [];
    }
  },

  save(queries: SavedQuery[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queries));
  },

  add(list: SavedQuery[], input: SavedQueryInput): SavedQuery[] {
    const newQuery: SavedQuery = {
      id: `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: input.name,
      sql: input.sql,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      usageCount: 0,
    };
    const updated = [...list, newQuery];
    sqlSavedQueries.save(updated);
    return updated;
  },

  updateUsage(list: SavedQuery[], id: string): SavedQuery[] {
    const updated = list.map(q =>
      q.id === id 
        ? { ...q, lastUsed: Date.now(), usageCount: q.usageCount + 1 }
        : q
    );
    sqlSavedQueries.save(updated);
    return updated;
  },

  remove(list: SavedQuery[], id: string): SavedQuery[] {
    const updated = list.filter(q => q.id !== id);
    sqlSavedQueries.save(updated);
    return updated;
  },

  update(list: SavedQuery[], id: string, changes: Partial<Pick<SavedQuery, 'name' | 'sql'>>): SavedQuery[] {
    const updated = list.map(q =>
      q.id === id ? { ...q, ...changes } : q
    );
    sqlSavedQueries.save(updated);
    return updated;
  },
};
