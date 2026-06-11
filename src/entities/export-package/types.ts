import { ColumnConfig } from "@/shared/lib/types";
import { Dashboard } from "../dashboard";
import { GroupMetricConfig } from "../group-metric-config";
import { HierarchyLevel } from "../hierarchy";
import { IndicatorGroup, MetricTemplate } from "../metric";


// types/index.ts
export interface DatasetConfigExport {
  version: 2;
  exportType: 'dataset_config';
  exportedAt: number;
  sourceDatasetId: string;
  data: {
    dashboards: Dashboard[];
    indicatorGroups: IndicatorGroup[];
    hierarchyLevels: HierarchyLevel[];
    columnConfigs: ColumnConfig[];
    metricTemplates: MetricTemplate[];
    groupMetricConfigs?: Record<string, Record<string, GroupMetricConfig>>;
  };
}