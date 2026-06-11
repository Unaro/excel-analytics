import { defineConfig } from 'vitest/config';

/**
 * Конфигурация Vitest.
 *
 * Окружение `node`: тестируется чистая логика (компиляция запросов,
 * агрегация, миграции) без DOM. Алиасы `@/*` берутся из tsconfig
 * через нативный resolve.tsconfigPaths.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['src/shared/lib/**'],
    },
  },
});
