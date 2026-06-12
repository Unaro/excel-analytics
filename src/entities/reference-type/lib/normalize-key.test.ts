import { describe, it, expect } from 'vitest';
import { normalizeKey } from './normalize-key';

describe('normalizeKey: подготовка кодов к сопоставлению со справочником', () => {
  it('none: только trim', () => {
    expect(normalizeKey('  01512000106 ', 'none')).toBe('01512000106');
    expect(normalizeKey(1512000106, 'none')).toBe('1512000106');
  });

  it('lpad11: восстанавливает ведущий ноль, потерянный Excel', () => {
    // 01512000106 → Excel прочитал числом 1512000106 (10 знаков)
    expect(normalizeKey(1512000106, 'lpad11')).toBe('01512000106');
    expect(normalizeKey('1512000106', 'lpad11')).toBe('01512000106');
  });

  it('lpad11: код полной длины не трогается', () => {
    expect(normalizeKey('01512000106', 'lpad11')).toBe('01512000106');
    expect(normalizeKey('98765432109', 'lpad11')).toBe('98765432109');
  });

  it('lpad8: дополняет до 8 знаков', () => {
    expect(normalizeKey(1201802, 'lpad8')).toBe('01201802');
  });

  it('хвост «.0» от числового парсинга срезается', () => {
    expect(normalizeKey('1512000106.0', 'lpad11')).toBe('01512000106');
  });

  it('нечисловые значения не дополняются нулями', () => {
    expect(normalizeKey('абв-123', 'lpad11')).toBe('абв-123');
  });

  it('null/undefined дают пустую строку', () => {
    expect(normalizeKey(null, 'lpad11')).toBe('');
    expect(normalizeKey(undefined, 'none')).toBe('');
  });
});
