import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

/**
 * Конфигурация Vitest.
 *
 * Окружение `node`: тестируется чистая логика (компиляция запросов,
 * агрегация, миграции) без DOM. Алиасы `@/*` подтягиваются из tsconfig
 * через vite-tsconfig-paths.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
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
