// src/types/data-table.ts
export interface DataRow {
  [key: string]: string | number | boolean | null | undefined;
}

export interface ColumnConfig {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  sortable?: boolean;
  filterable?: boolean;
  width?: number;
  align?: 'left' | 'center' | 'right';
  render?: (value: DataRow[keyof DataRow], row: DataRow) => React.ReactNode;
}

export interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
}

export interface FilterConfig {
  [columnKey: string]: string;
}

export interface ColumnVisibility {
  [columnKey: string]: boolean;
}

export interface PaginationConfig {
  page: number;
  itemsPerPage: number;
  totalItems: number;
}

export interface ColumnStats {
  sum: number;
  avg: number;
  min: number;
  max: number;
  count: number;
}

export interface ColumnStatsMap {
  [columnKey: string]: ColumnStats;
}

export type ViewMode = 'table' | 'cards';
export type ExportFormat = 'csv' | 'json' | 'xlsx';
