export type SetupStep = 'manager' | 'upload' | 'import' | 'columns';
export type SourceType = 'file' | 'postgres';
export type PgStep = 'connection' | 'browser';

/**
 * Выбор пользователя при импорте «готовой конфигурации»: какие группы/шаблоны/
 * дашборды включить и переименования (id → новое имя). Шаблоны, на которые
 * ссылаются включённые группы, добавляются автоматически (см. filterConfigBySelection).
 */
export interface ConfigSelection {
  groupIds: Set<string>;
  templateIds: Set<string>;
  dashboardIds: Set<string>;
  renames: Record<string, string>;
}