import type { DatasetRow } from "@/types";

/**
 * Статистика по колонке (для авто-классификации и UI)
 */
export interface ColumnStatistics {
  columnName: string;
  totalValues: number;
  nullCount: number;
  uniqueCount: number;
  numericCount: number;
  textCount: number;
  booleanCount: number;
  dateCount: number;
  sampleValues: (string | number | boolean | null)[];
  min?: number;
  max?: number;
  avg?: number;
  sum?: number;
  median?: number;
}

export interface SheetData {
  sheetName: string;
  headers: string[];
  rows: DatasetRow[];
}