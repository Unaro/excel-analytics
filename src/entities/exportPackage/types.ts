import { ColumnConfig, HierarchyLevel, Dashboard, IndicatorGroup, MetricTemplate } from "@/types";


// types/index.ts
export interface DatasetConfigExport {
  version: 1;
  exportType: 'dataset_config';
  exportedAt: number;
  sourceDatasetId: string;
  data: {
    dashboards: Dashboard[];
    indicatorGroups: IndicatorGroup[];
    hierarchyLevels: HierarchyLevel[];
    columnConfigs: ColumnConfig[];
    metricTemplates: MetricTemplate[];
  };
}