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

export interface GroupResult {
  groupId: string;
  groupName: string;
  filters: FilterCondition[];
  indicators: {
    name: string;
    formula: string;
    value: number;
  }[];
  rowCount: number;
  timestamp: number;
}

export interface DashboardMetric {
  label: string;
  value: number;
  unit?: string;
  trend?: number;
  status?: 'positive' | 'negative' | 'neutral';
}