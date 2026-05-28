import { createHash } from 'crypto';

/**
 * Формирует ключ дедупликации виртуальной метрики.
 * Две VM считаются "одной колонкой в таблице", если у них:
 *  - одинаковое имя
 *  - одинаковый формат отображения
 *  - одинаковое число десятичных знаков
 *  - одинаковая единица измерения
 */
export function vmDedupeKey(
  name: string,
  format: string,
  decimals: number,
  unit?: string
): string {
  return `${name}::${format}::${decimals}::${unit ?? ''}`;
}

/**
 * Строит детерминированный VM ID на основе ключа дедупликации.
 * Использует короткий хеш, чтобы ID был:
 *   - стабильным (одинаковый ключ → одинаковый ID всегда)
 *   - компактным (не раздувает JSON и URL)
 *   - URL-safe (без спецсимволов)
 *
 */
export function buildDeterministicVmId(key: string): string {
  // Используем первые 16 hex-символов SHA-256 = 64 бита энтропии.
  // Коллизии практически невозможны в рамках одного дашборда.
  const hash = createHash('sha256').update(key).digest('hex').slice(0, 16);
  return `vm-${hash}`;
}

/**
 * Удобная обёртка: строит VM ID сразу из полей метрики.
 */
export function buildVmIdFromFields(
  name: string,
  format: string,
  decimals: number,
  unit?: string
): string {
  return buildDeterministicVmId(vmDedupeKey(name, format, decimals, unit));
}

/**
 * Формирует уникальный ID для FieldBinding внутри группы.
 * Используется при создании "фейковых" метрик (например, для HierarchyFilter COUNT).
 */
export function buildFieldBindingId(groupId: string, fieldAlias: string): string {
  return `fb-${groupId}-${fieldAlias}`;
}

/**
 * Формирует уникальный ID GroupMetric внутри дашборда.
 */
export function buildGroupMetricId(groupId: string, suffix: string): string {
  return `m-${groupId}-${suffix}`;
}