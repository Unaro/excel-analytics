export interface ExcelRow {
  [key: string]: string | number | boolean | null;
}

export interface GroupDefinition {
  id: string;
  name: string;
  indicators: string[];
  formula?: string;
}

export interface StatisticsRule {
  column: string;
  condition: string;
  value: string | number;
  aggregation: 'sum' | 'count' | 'avg' | 'min' | 'max';
}

export interface SheetData {
  sheetName: string;
  headers: string[];
  rows: ExcelRow[];
}
