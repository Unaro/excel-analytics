import type { IndicatorWithValue } from "@/lib/data-store";
import type { ExcelRow, FilterCondition, HierarchyFilters } from ".";

export interface DashboardConfig {
  mode: 'auto' | 'comparison' | 'analysis' | 'custom';
  
  // Для режима сравнения
  comparisonConfig?: {
    selectedIndicator: string;
    selectedGroups: string[];
  };
  
  // Для режима анализа
  analysisConfig?: {
    selectedGroup: string;
    selectedIndicators: string[];
  };
  
  // Для кастомного режима
  customWidgets?: DashboardWidget[];
  
  // Общие настройки
  showKPI: boolean;
  showTable: boolean;
  chartTypes: ('bar' | 'line' | 'pie' | 'radar')[];
}

interface DashboardWidget {
  id: string;
  type: 'bar' | 'line' | 'pie' | 'table' | 'kpi' | 'radar';
  title: string;
  groups: string[];        // ID выбранных групп
  indicators: string[];    // Названия выбранных показателей
  layout: { x: number; y: number; w: number; h: number }; // Grid layout
}

export interface ChartDataPoint {
  name: string;
  [key: string]: string | number;
}

export interface PieChartData {
  name: string;
  value: number;
}

export interface IndicatorValue {
  name: string;
  value: number;
}
export interface GroupResult {
  groupId: string;
  groupName: string;
  filters: Array<{
    id: string;
    column: string;
    operator: string;
    value: string;
  }>;
  hierarchyFilters: Record<string, string> | undefined;
  deepestFilter: {
    column: string;
    value: string;
  } | null;
  indicators: Array<{
    name: string;
    formula: string;
    value: number;
  }>;
  rowCount: number;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  filters: FilterCondition[];
  hierarchyFilters?: HierarchyFilters;  // Record<string, string>
  indicators: Indicator[];
  createdAt: number;
  updatedAt: number;
}

export interface GroupWithData extends Group {
  rowCount: number;
  indicators: IndicatorWithValue[];
}

export interface Metric {
  name: string;
  formula: string;
  aggregatedValue: number;
  stats: MetricStatistics;
}

export interface MetricStatistics {
  mean: number;
  median: number;
  stdDev: number;
  min?: number;
  max?: number;
}

export interface Indicator {
  name: string;
  formula: string;
  value?: number;
}

// Для страницы Overview
export interface IndicatorData {
  name: string;
  values: Record<string, number>; // groupId -> value
}

// Для страницы Comparison
export interface ComparisonData {
  indicator: string;
  groups: {
    groupId: string;
    groupName: string;
    value: number;
  }[];
}

// Для страницы SQL
export interface SQLResult {
  headers: string[];
  rows: ExcelRow[];
}

export interface SavedQuery {
  id: string;
  name: string;
  query: string;
  createdAt: number;
}