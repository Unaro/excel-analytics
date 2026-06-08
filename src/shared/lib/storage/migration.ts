/**
 * Фабрика миграций для Zustand persist.
 * 
 * Применяет цепочку миграций последовательно: v1 → v2 → v3 → ... → vN.
 * Каждая миграция — это функция, принимающая persistedState и возвращающая
 * обновлённое состояние.
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
  return (persistedState: unknown): TState => {
    const persisted = (persistedState ?? {}) as Record<string, unknown>;
    const persistedVersion = typeof persisted.__version === 'number' ? persisted.__version : 0;
    const targetVersion = Math.max(...Object.keys(migrations).map(Number), 0);

    if (persistedVersion >= targetVersion) {
      return persisted as TState;
    }

    let migrated = { ...persisted };
    for (let v = persistedVersion + 1; v <= targetVersion; v++) {
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