// shared/lib/computation/lib/duckdb/prepared-statement-cache.ts
// ─────────────────────────────────────────────────────────────
// LRU-кэш Prepared Statements для DuckDB.
//
// Эффект:
//   - Убирает повторную компиляцию SQL для одинаковых запросов
//   - ~2× ускорение для повторяющихся вычислений (смена фильтров)
//   - Особенно критично при drill-down в иерархии
//
// Архитектура:
//   - Ключ: FNV-1a хеш SQL-строки (быстрый и детерминированный)
//   - Лимит: 50 statements (LRU-eviction)
//   - Auto-invalidation: при изменении схемы (DROP/CREATE TABLE)
//
// Типизация:
//   Тип prepared statement выводится из сигнатуры
//   `conn.prepare()` через Awaited<ReturnType<...>>.
//   Это работает с любой версией @duckdb/duckdb-wasm,
//   т.к. не требует знания точного имени экспорта.
// ─────────────────────────────────────────────────────────────

import { logger } from '@/shared/lib/logger';
import type * as duckdb from '@duckdb/duckdb-wasm';

const MAX_CACHE_SIZE = 50;

/**
 * Выводим тип prepared statement из сигнатуры conn.prepare().
 * Это единственный типобезопасный способ, т.к. в @duckdb/duckdb-wasm
 * нет экспорта PreparedConnection (есть только PreparedStatement,
 * но он не экспортируется публично из browser-бандла).
 */
type PreparedStatement = Awaited<
  ReturnType<duckdb.AsyncDuckDBConnection['prepare']>
>;

interface CacheEntry {
  statement: PreparedStatement;
  sql: string;
  lastUsed: number;
}

/**
 * LRU-кэш prepared statements.
 * Singleton — используется в worker.ts для ускорения повторяющихся SQL.
 */
export class PreparedStatementCache {
  private cache = new Map<string, CacheEntry>();
  private conn: duckdb.AsyncDuckDBConnection | null = null;

  /**
   * Привязывает соединение к кэшу.
   * Вызывается при инициализации и auto-recovery worker'а.
   * При смене соединения весь кэш инвалидируется (старые prepared
   * statements более не действительны).
   */
  bind(conn: duckdb.AsyncDuckDBConnection | null): void {
    this.conn = conn;
    this.invalidateAll();
  }

  /**
   * Возвращает prepared statement из кэша или создаёт новый.
   * Обновляет lastUsed для LRU-стратегии.
   *
   * @returns PreparedStatement или null, если:
   *   - соединение не привязано
   *   - prepare() выбросил ошибку (несовместимый SQL)
   */
  async getOrCreate(sql: string): Promise<PreparedStatement | null> {
    if (!this.conn) return null;

    const key = this.hashSql(sql);
    const existing = this.cache.get(key);

    if (existing && existing.sql === sql) {
      existing.lastUsed = Date.now();
      return existing.statement;
    }

    try {
      const statement = await this.conn.prepare(sql);
      this.cache.set(key, {
        statement,
        sql,
        lastUsed: Date.now(),
      });

      if (this.cache.size > MAX_CACHE_SIZE) {
        this.evictOldest();
      }

      return statement;
    } catch (err) {
      logger.warn('[PreparedStatementCache] Prepare failed:', err);
      return null;
    }
  }

  /**
   * Инвалидирует весь кэш.
   * Вызывается при DROP TABLE, CREATE TABLE, auto-recovery.
   *
   * DuckDB-WASM сам освобождает prepared statements при закрытии
   * соединения — здесь только очищаем Map.
   */
  invalidateAll(): void {
    this.cache.clear();
  }

  /**
   * Инвалидирует statements для конкретной таблицы.
   * Используется при замене файла датасета.
   */
  invalidateForTable(tableName: string): void {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.sql.includes(tableName)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Статистика кэша (для мониторинга).
   */
  getStats(): { size: number; max: number } {
    return { size: this.cache.size, max: MAX_CACHE_SIZE };
  }

  // ─── Приватные методы ─────────────────────────────────────

  /**
   * FNV-1a 32-bit hash — быстрый, детерминированный, без crypto API.
   * Возвращает base36-строку для компактности ключей.
   */
  private hashSql(sql: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < sql.length; i++) {
      hash ^= sql.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(36);
  }

  /**
   * Удаляет наименее недавно использованный элемент (LRU eviction).
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastUsed < oldestTime) {
        oldestTime = entry.lastUsed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}

/**
 * Singleton-инстанс кэша.
 * Используется в worker.ts для ускорения повторяющихся SQL-запросов.
 */
export const preparedStatementCache = new PreparedStatementCache();