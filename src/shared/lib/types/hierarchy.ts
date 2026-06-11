// shared/lib/types/hierarchy.ts
// ─────────────────────────────────────────────────────────────
// Универсальные типы иерархии, используемые в shared и entities.
// Реэкспортируем тип из Zod-схемы как single source of truth.
// ─────────────────────────────────────────────────────────────

export type { HierarchyFilterValue } from '@/shared/lib/validators';

/**
 * Один уровень иерархии (например: Страна -> Город -> Район).
 *
 * Живёт в shared: используется сервисами экспорта/импорта конфигурации.
 */
export interface HierarchyLevel {
  id: string;
  columnName: string;
  displayName: string;
  order: number;
}