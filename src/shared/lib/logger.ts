/* eslint-disable no-console */
// shared/lib/logger.ts
// ─────────────────────────────────────────────────────────────
// Единственное легитимное место прямых вызовов console.* —
// во всём остальном src/ они запрещены правилом no-console.
// ─────────────────────────────────────────────────────────────

type LogArgs = unknown[];

const isProd = process.env.NODE_ENV === 'production';

/**
 * Логгер приложения с уровнями.
 *
 * - `debug` — диагностика разработки; в production полностью отключён;
 * - `info` — значимые события жизненного цикла (импорт завершён, гидрация);
 *   в production отключён;
 * - `warn` — деградации, не ломающие сценарий (fallback, переполнение квоты);
 * - `error` — ошибки, влияющие на пользователя.
 *
 * Соглашение: первым аргументом — тег модуля в квадратных скобках,
 * например `logger.warn('[computation-cache] квота исчерпана', err)`.
 */
export const logger = {
  /** Отладочный вывод. Полностью вырезается в production. */
  debug(...args: LogArgs): void {
    if (!isProd) console.debug(...args);
  },

  /** События жизненного цикла. Отключён в production. */
  info(...args: LogArgs): void {
    if (!isProd) console.info(...args);
  },

  /** Деградация без потери функциональности. Виден и в production. */
  warn(...args: LogArgs): void {
    console.warn(...args);
  },

  /** Ошибка, влияющая на пользователя. Видна и в production. */
  error(...args: LogArgs): void {
    console.error(...args);
  },
};
