import { Dashboard } from "../dashboard";
import { ColumnConfig } from "../dataset";
import { HierarchyLevel } from "../hierarchy";
import { IndicatorGroup, MetricTemplate } from "../metric";


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