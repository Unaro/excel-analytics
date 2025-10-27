export interface ExcelRow {
  [key: string]: string | number | boolean | null;
}

export interface FilterCondition {
  id: string;
  column: string;
  operator: '=' | '>' | '<' | '>=' | '<=' | '!=' | 'contains';
  value: string | number;
}

export interface GroupDefinition {
  id: string;
  name: string;
  filters: FilterCondition[];
  indicators: {
    name: string;
    formula: string;
  }[];
}

export interface SheetData {
  sheetName: string;
  headers: string[];
  rows: ExcelRow[];
}

export type ColumnDataType = 'numeric' | 'categorical' | 'text' | 'date';

export type columnType = 'number' | 'text' | 'mixed'

export interface ColumnMetadata {
  name: string;
  dataType: ColumnDataType;
  autoDetectedType: columnType;
  description?: string;
  allowInFormulas: boolean;
}

export interface DatasetMetadata {
  sheetName: string;
  columns: ColumnMetadata[];
  lastModified: number;
}

export interface FieldInfo {
  name: string;
  type: columnType;
  sampleValues: (string | number | boolean | null)[];
  numericCount: number;
  totalCount: number;
  isAllowedInFormulas: boolean;
  min?: number;
  max?: number;
  avg?: number;
}