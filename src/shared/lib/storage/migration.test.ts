import { describe, it, expect } from 'vitest';
import { createMigration } from './migration';

interface TestState {
  items: string[];
  newField?: string;
  anotherField?: number[];
}

describe('createMigration (контракт Zustand: migrate(state, version))', () => {
  const migrate = createMigration<TestState>({
    2: (state) => ({ ...state, newField: 'default' }),
    3: (state) => ({ ...state, anotherField: [] }),
  });

  it('состояние актуальной версии возвращается без изменений', () => {
    const state = { items: ['a'], newField: 'x', anotherField: [1] };
    expect(migrate(state, 3)).toEqual(state);
  });

  it('версия выше целевой не мигрируется (downgrade-защита)', () => {
    const state = { items: ['a'] };
    expect(migrate(state, 5)).toEqual(state);
  });

  it('цепочка v1 → v3 применяет обе миграции по порядку', () => {
    const result = migrate({ items: ['a'] }, 1);

    expect(result).toEqual({
      items: ['a'],
      newField: 'default',
      anotherField: [],
    });
  });

  it('промежуточный старт v2 → v3 применяет только недостающую миграцию', () => {
    const result = migrate({ items: ['a'], newField: 'кастом' }, 2);

    expect(result.newField).toBe('кастом'); // миграция v2 не перезаписала
    expect(result.anotherField).toEqual([]);
  });

  it('пропуски в карте миграций не ломают цепочку', () => {
    const sparse = createMigration<TestState>({
      3: (state) => ({ ...state, anotherField: [3] }),
    });

    expect(sparse({ items: [] }, 0)).toEqual({ items: [], anotherField: [3] });
  });

  it('null/undefined persistedState мигрируется от пустого объекта', () => {
    const result = migrate(null, 0);

    expect(result.newField).toBe('default');
    expect(result.anotherField).toEqual([]);
  });

  it('не мутирует исходное состояние', () => {
    const original = { items: ['a'] };
    migrate(original, 1);

    expect(original).toEqual({ items: ['a'] });
  });
});
