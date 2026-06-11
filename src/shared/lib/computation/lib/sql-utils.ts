/**
 * Общие SQL-утилиты для компиляции запросов (DuckDB и PostgreSQL).
 */

/**
 * Экранирует SQL-идентификатор (имя таблицы, схемы, колонки, алиас):
 * оборачивает в двойные кавычки, удваивая кавычки внутри.
 *
 * Защищает от инъекции через идентификатор, но НЕ проверяет существование
 * объекта — для PostgreSQL имена дополнительно валидируются по whitelist
 * из information_schema на сервере (см. server-actions/pg-compute.ts).
 */
export function quoteIdent(id: string): string {
  return `"${id.replace(/"/g, '""')}"`;
}

/**
 * Собирает полное квалифицированное имя таблицы `"schema"."table"`.
 */
export function qualifiedTableName(schema: string, table: string): string {
  return `${quoteIdent(schema)}.${quoteIdent(table)}`;
}
