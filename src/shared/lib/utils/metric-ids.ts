import { createHash } from 'crypto';

/**
 * Формирует ключ дедупликации виртуальной метрики.
 */
export function vmDedupeKey(
  groupId: string,
  metricId: string,
  name: string,
  format: string,
  decimals: number,
  unit?: string
): string {
  return `${groupId}::${metricId}::${name}::${format}::${decimals}::${unit ?? ''}`;
}

/**
 * Строит детерминированный ID виртуальной метрики из ключа дедупликации
 * (sha256, первые 16 hex-символов) — одинаковые метрики при повторном
 * импорте получают одинаковые ID.
 */
export function buildDeterministicVmId(key: string): string {
  const hash = createHash('sha256').update(key).digest('hex').slice(0, 16);
  return `vm-${hash}`;
}

/**
 * Удобная обёртка: строит VM ID сразу из полей метрики.
 */
export function buildVmIdFromFields(
  groupId: string,
  metricId: string,
  name: string,
  format: string,
  decimals: number,
  unit?: string
): string {
  return buildDeterministicVmId(vmDedupeKey(groupId, metricId, name, format, decimals, unit));
}