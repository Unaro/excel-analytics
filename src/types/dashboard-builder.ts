export type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'metric' | 'table';
export type DataSource = 'groups' | 'sql' | 'raw';
export type DataScope = 'hierarchy' | 'global';

export interface ChartConfig {
  id: string;
  type: ChartType;
  title: string;
  dataSource: DataSource;
  dataScope?: DataScope; // Новое поле: учитывать ли иерархические фильтры
  
  // Для groups
  groupIds?: string[];
  indicators?: string[];
  
  // Для SQL
  sqlQuery?: string;
  
  // Общие настройки
  xAxis?: string;
  yAxis?: string[];
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
  
  // Стиль
  colors?: string[];
  showLegend?: boolean;
  showGrid?: boolean;
  
  // Позиция в сетке
  x: number;
  y: number;
  w: number; // ширина в единицах сетки (1-12)
  h: number; // высота в единицах сетки (1-12)
}

export interface DashboardFilter {
  id: string;
  column: string;
  type: 'select' | 'multiselect' | 'range' | 'date' | 'search';
  label: string;
  selectedValues?: string[];
  rangeMin?: number;
  rangeMax?: number;
  dateFrom?: string;
  dateTo?: string;
  searchTerm?: string;
}

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  charts: ChartConfig[];
  filters: DashboardFilter[];
  createdAt: number;
  updatedAt: number;
}