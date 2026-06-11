// entities/hierarchy/model/types.ts
// ─────────────────────────────────────────────────────────────
// Реэкспорт HierarchyFilterValue из shared для обратной совместимости.
// ─────────────────────────────────────────────────────────────

import type {
  HierarchyFilterValue,
  HierarchyLevel,
} from '@/shared/lib/types/hierarchy';

// HierarchyLevel перенесён в shared/lib/types/hierarchy (нужен сервисам
// экспорта/импорта конфигурации) — ре-экспорт для обратной совместимости.
export type { HierarchyLevel };

/**
 * Узел в дереве иерархии (для UI).
 */
export interface HierarchyNode {
  value: string;
  displayValue: string;
  level: HierarchyLevel;
  childCount: number;
  recordCount: number;
  children?: HierarchyNode[];
  isExpanded?: boolean;
  isSelected?: boolean;
}

/**
 * Конфигурация всей иерархии.
 */
export interface HierarchyConfig {
  levels: HierarchyLevel[];
  maxDepth: number;
  allowMultipleSelection: boolean;
  autoExpandFirstLevel: boolean;
}

export interface BuildHierarchyTreeRequest {
  levels: HierarchyLevel[];
  parentFilters?: HierarchyFilterValue[];
  maxDepth?: number;
  includeRecordCount?: boolean;
}

export interface HierarchyTreeResult {
  nodes: HierarchyNode[];
  totalRecords: number;
  buildTime: number;
}

export interface GetLevelValuesOptions {
  levelId: string;
  parentFilters: HierarchyFilterValue[];
  search?: string;
  limit?: number;
  offset?: number;
}