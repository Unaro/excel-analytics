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
