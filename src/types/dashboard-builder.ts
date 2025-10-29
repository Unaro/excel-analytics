export type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'metric' | 'table';

export interface ChartConfig {
  id: string;
  type: ChartType;
  title: string;
  dataSource: 'groups' | 'sql' | 'raw';
  
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
  
  // Позиция
  x: number;
  y: number;
  w: number; // ширина в единицах сетки
  h: number; // высота в единицах сетки
}

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  charts: ChartConfig[];
  createdAt: number;
  updatedAt: number;
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
  filters: DashboardFilter[]; // Добавляем фильтры
  createdAt: number;
  updatedAt: number;
}