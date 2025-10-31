export interface ExcelRow {
  [key: string]: string | number | boolean | null;
}

export type HierarchyFilters = Record<string, string>;

export type FilterOperator = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'contains';

export interface FilterCondition {
  id: string;
  column: string;
  operator: FilterOperator;
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

export type DataRow = Record<string, string | number | Date | null | undefined>;


export interface SelectOption {
  value: string;
  label: string;
}

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}
