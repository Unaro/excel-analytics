import { logger } from '@/shared/lib/logger';
import { get, set, del } from 'idb-keyval';

/**
 * Хранилище построенных словарей «нормализованный код → наименование».
 *
 * Словарь строится один раз при создании/замене справочника (выгрузка
 * пар из DuckDB-таблицы) и персистится в IndexedDB — рантайм-подстановка
 * не зависит от состояния воркера и гидрации Arrow-буферов.
 *
 * Память: модульный кэш Map на тип; инвалидируется при пересборке
 * (replace справочника) и удалении типа.
 */

const DICT_KEY_PREFIX = 'refdict:';

const memoryCache = new Map<string, Map<string, string>>();

/** Сохраняет словарь типа (перезаписывает целиком). */
export async function saveDictionary(
  typeId: string,
  pairs: Array<[string, string]>
): Promise<void> {
  await set(`${DICT_KEY_PREFIX}${typeId}`, pairs);
  memoryCache.set(typeId, new Map(pairs));
}

/**
 * Загружает словарь типа (память → IndexedDB). null — словарь не построен.
 */
export async function loadDictionary(
  typeId: string
): Promise<Map<string, string> | null> {
  const cached = memoryCache.get(typeId);
  if (cached) return cached;

  try {
    const pairs = (await get(`${DICT_KEY_PREFIX}${typeId}`)) as
      | Array<[string, string]>
      | undefined;
    if (!pairs) return null;
    const map = new Map(pairs);
    memoryCache.set(typeId, map);
    return map;
  } catch (err) {
    logger.warn('[reference-type] Не удалось загрузить словарь:', err);
    return null;
  }
}

/** Удаляет словарь типа (при удалении типа или пересборке с ошибкой). */
export async function deleteDictionary(typeId: string): Promise<void> {
  memoryCache.delete(typeId);
  await del(`${DICT_KEY_PREFIX}${typeId}`);
}

/** Сбрасывает только память (словарь перечитается из IndexedDB). */
export function invalidateDictionaryCache(typeId?: string): void {
  if (typeId) memoryCache.delete(typeId);
  else memoryCache.clear();
}
