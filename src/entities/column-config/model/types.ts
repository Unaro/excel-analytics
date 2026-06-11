// entities/columnConfig/model/types.ts
import type { DatasetRow } from '@/shared/lib/types/dataset';

// ─────────────────────────────────────────────────────────────
// Реэкспорт ColumnStatistics из shared
// ─────────────────────────────────────────────────────────────
export type { ColumnStatistics } from '@/shared/lib/types/dataset';

export interface SheetData {
  sheetName: string;
  headers: string[];
  rows: DatasetRow[];
}