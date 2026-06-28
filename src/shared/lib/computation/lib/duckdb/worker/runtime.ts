/// <reference lib="webworker" />

// Состояние движка DuckDB в воркере: соединение, инициализация (EH→MVP),
// настройки память↔время, кэш схемы. ES-модуль — синглтон, поэтому db/conn
// живут ровно как прежние переменные уровня worker.ts. Обработчики команд
// берут соединение через requireConn()/getConn().

import * as duckdb from '@duckdb/duckdb-wasm';
import { logger } from '@/shared/lib/logger';
import { preparedStatementCache } from '../prepared-statement-cache';
import { toAbsoluteUrl } from './lib';
import type { ConfigureEnginePayload } from './messages';

const EH_BUNDLE = {
  mainModule: toAbsoluteUrl('/duckdb/duckdb-eh.wasm'),
  mainWorker: toAbsoluteUrl('/duckdb/duckdb-browser-eh.worker.js'),
};

const MVP_BUNDLE = {
  mainModule: toAbsoluteUrl('/duckdb/duckdb-mvp.wasm'),
  mainWorker: toAbsoluteUrl('/duckdb/duckdb-browser-mvp.worker.js'),
};

let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;

// Настройки движка (память ↔ время). Хранятся на уровне модуля, чтобы
// переживать пересоздание соединения и переприменяться после каждого initDB.
// Менеджер пересылает их заново при перезапуске самого воркера.
let engineConfig: ConfigureEnginePayload | null = null;

// Кэш схемы таблицы (имена колонок из DESCRIBE). COMPUTE дёргает DESCRIBE на
// каждый пересчёт (один клик фильтра = несколько COMPUTE), а схема меняется
// только при импорте/перезагрузке/удалении таблицы. Инвалидируется вместе с
// prepared-кэшем через invalidateTableCaches (аудит №12).
export const schemaCache = new Map<string, string[]>();

export function getDb(): duckdb.AsyncDuckDB | null {
  return db;
}

export function getConn(): duckdb.AsyncDuckDBConnection | null {
  return conn;
}

/** Соединение, гарантированно установленное (после initDB) — иначе бросает. */
export function requireConn(): duckdb.AsyncDuckDBConnection {
  if (!conn) throw new Error('DuckDB connection was not established after initDB()');
  return conn;
}

/** БД, гарантированно инициализированная — иначе бросает. */
export function requireDb(): duckdb.AsyncDuckDB {
  if (!db) throw new Error('DuckDB was not initialized');
  return db;
}

/** Сбрасывает кэши, привязанные к таблице (prepared + схема). */
export function invalidateTableCaches(tableName: string): void {
  preparedStatementCache.invalidateForTable(tableName);
  schemaCache.delete(tableName);
}

/** Запоминает настройки движка (применяются при applyEngineConfig/initDB). */
export function setEngineConfig(config: ConfigureEnginePayload): void {
  engineConfig = config;
}

/**
 * Применяет текущие настройки движка к открытому соединению.
 *
 * Управляем только `memory_limit` — ограничение пиковой памяти (ценой
 * возможного замедления). `threads` НЕ трогаем: wasm-сборка EH скомпилирована
 * без потоков, и любой `SET/RESET threads` бросает «compiled without threads».
 */
export async function applyEngineConfig(): Promise<void> {
  if (!conn || !engineConfig) return;
  const { memoryLimitMB } = engineConfig;
  try {
    if (memoryLimitMB != null && memoryLimitMB > 0) {
      await conn.query(`SET memory_limit='${memoryLimitMB}MB'`);
    } else {
      // Снятие лимита: вернуть дефолт DuckDB.
      await conn.query(`RESET memory_limit`);
    }
    logger.debug('[DuckDB] ⚙️ Engine config applied:', engineConfig);
  } catch (err) {
    logger.warn('[DuckDB] Failed to apply engine config:', err);
  }
}

async function loadWorkerScript(workerUrl: string): Promise<Worker> {
  try {
    return new Worker(workerUrl);
  } catch (directErr) {
    logger.warn('[DuckDB] Direct worker load failed, using blob fallback:', directErr);
  }
  const response = await fetch(workerUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch worker script: ${response.status} ${response.statusText} from ${workerUrl}`
    );
  }
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  return new Worker(blobUrl);
}

let initPromise: Promise<void> | null = null;

export async function initDB(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const worker = await loadWorkerScript(EH_BUNDLE.mainWorker);
      const duckdbLogger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
      db = new duckdb.AsyncDuckDB(duckdbLogger, worker);
      await db.instantiate(EH_BUNDLE.mainModule);
      conn = await db.connect();
      logger.debug('[DuckDB] ✅ Initialized with EH bundle');
      preparedStatementCache.bind(conn);
      await applyEngineConfig();
    } catch (ehError) {
      logger.warn('[DuckDB] EH bundle failed, falling back to MVP:', ehError);
      try {
        const worker = await loadWorkerScript(MVP_BUNDLE.mainWorker);
        const duckdbLogger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
        db = new duckdb.AsyncDuckDB(duckdbLogger, worker);
        await db.instantiate(MVP_BUNDLE.mainModule);
        conn = await db.connect();
        logger.debug('[DuckDB] ✅ Initialized with MVP bundle (fallback)');
        preparedStatementCache.bind(conn);
        await applyEngineConfig();
      } catch (mvpError) {
        initPromise = null;
        throw new Error(
          `DuckDB initialization failed: ${
            mvpError instanceof Error ? mvpError.message : 'Unknown'
          }`
        );
      }
    }
  })();

  return initPromise;
}
