import type { KeyNormalization } from '../model/types';

/**
 * Приводит код к каноничному виду для сопоставления со справочником.
 *
 * Применяется СИММЕТРИЧНО: к ключам справочника при построении словаря
 * и к значениям данных при поиске — иначе потерянные Excel'ем ведущие
 * нули («01512000106» → 1512000106) ломают сопоставление.
 *
 * lpad8/lpad11 дополняют ЧИСЛОВОЙ код нулями слева до 8/11 знаков;
 * нечисловые значения (уже отформатированные строки) не трогаются.
 */
export function normalizeKey(raw: unknown, normalization: KeyNormalization): string {
  let s = String(raw ?? '').trim();
  // Числовые значения из Excel могут приходить в виде «1512000106.0»
  if (/^\d+\.0$/.test(s)) s = s.slice(0, -2);

  if (normalization === 'none') return s;

  const width = normalization === 'lpad8' ? 8 : 11;
  if (/^\d+$/.test(s) && s.length < width) {
    return s.padStart(width, '0');
  }
  return s;
}
