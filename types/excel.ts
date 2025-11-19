// types/excel.ts

/**
 * Одна строка из Excel файла
 * Ключи - названия колонок, значения - данные ячеек
 */
export interface ExcelRow {
  [columnName: string]: string | number | boolean | null;
}

/**
 * Данные одного листа Excel
 */
export interface SheetData {
  sheetName: string;
  headers: string[];
  rows: ExcelRow[];
}

/**
 * Метаданные загруженного Excel файла
 */
export interface ExcelMetadata {
  fileName: string;
  uploadedAt: number;
  sheetNames: string[];
  totalRows: number;
  totalColumns: number;
}

/**
 * Статистика по колонке для автоопределения типа
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
  
  // Статистика для числовых колонок
  min?: number;
  max?: number;
  avg?: number;
  sum?: number;
  median?: number;
}
