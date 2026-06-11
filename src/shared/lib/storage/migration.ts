/**
 * Фабрика миграций для Zustand persist.
 *
 * Применяет цепочку миграций последовательно: v1 → v2 → v3 → ... → vN.
 * Каждая миграция — функция, принимающая состояние предыдущей версии
 * и возвращающая состояние своей версии.
 *
 * Контракт Zustand persist: middleware вызывает
 * `migrate(persistedState, version)`, где `version` — версия, записанная
 * в обёртке localStorage (`{ state, version }`), а НЕ поле внутри state.
 *
 * @param migrations - Карта «целевая версия → функция миграции».
 *   Ключ `2` означает «мигрирует состояние v1 в v2».
 * @returns Функция `migrate` для опций persist.
 *
 * @example
 * ```ts
 * persist(
 *   (set, get) => ({...}),
 *   {
 *     name: 'my-storage',
 *     version: 3,
 *     migrate: createMigration<MyState>({
 *       2: (state) => ({ ...state, newField: 'default' }),
 *       3: (state) => ({ ...state, anotherField: [] }),
 *     }),
 *   }
 * )
 * ```
 */
export function createMigration<TState>(
  migrations: Record<number, (state: Record<string, unknown>) => Record<string, unknown>>
) {
  const targetVersion = Math.max(...Object.keys(migrations).map(Number), 0);

  return (persistedState: unknown, version: number): TState => {
    let migrated = { ...((persistedState ?? {}) as Record<string, unknown>) };

    if (version >= targetVersion) {
      return migrated as TState;
    }

    for (let v = version + 1; v <= targetVersion; v++) {
      const migrationFn = migrations[v];
      if (migrationFn) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Migration] ${v - 1} → ${v}`);
        }
        migrated = migrationFn(migrated);
      }
    }

    return migrated as TState;
  };
}
