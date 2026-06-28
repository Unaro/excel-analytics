import { describe, it, expect } from 'vitest';
import { encodePathValues, decodePathValues } from './group-path-codec';

describe('group-path-codec', () => {
  it('round-trip: значения уровней через «/»', () => {
    expect(encodePathValues(['Москва', 'Центр'])).toBe('Москва/Центр');
    expect(decodePathValues('Москва/Центр')).toEqual(['Москва', 'Центр']);
  });

  it('пустой путь', () => {
    expect(encodePathValues([])).toBe('');
    expect(decodePathValues('')).toEqual([]);
    expect(decodePathValues(null)).toEqual([]);
    expect(decodePathValues(undefined)).toEqual([]);
  });

  it('коды (ASCII) тоже проходят', () => {
    expect(decodePathValues('77/77001')).toEqual(['77', '77001']);
  });

  it('легаси JSON (?filters=, single-encoded → «[…]») → значения', () => {
    const legacy = JSON.stringify([
      { levelId: 'l0', levelIndex: 0, columnName: 'city', value: 'Москва', displayValue: 'Москва' },
      { levelId: 'l1', levelIndex: 1, columnName: 'zone', value: 'Центр', displayValue: 'Центр' },
    ]);
    expect(decodePathValues(legacy)).toEqual(['Москва', 'Центр']);
  });

  it('легаси старый ?path= (double-encoded → «%5B…») → значения', () => {
    const legacy = encodeURIComponent(
      JSON.stringify([{ levelId: 'l0', levelIndex: 0, columnName: 'city', value: 'Москва' }])
    );
    expect(legacy.startsWith('%5B')).toBe(true);
    expect(decodePathValues(legacy)).toEqual(['Москва']);
  });

  it('битый JSON-подобный вход не роняет — падает в split', () => {
    expect(decodePathValues('[broken')).toEqual(['[broken']);
  });
});
