import { IndicatorGroup } from "@/entities/metric";
import { IndicatorGroupInDashboard, DashboardColumn } from "@/shared/lib/validators";

export interface GroupAdderProps {
  availableGroups: IndicatorGroup[];
  dashboardGroups: IndicatorGroupInDashboard[];
  onAdd: (groupId: string) => void;
}

export interface MappingRowProps {
  groupConfig: IndicatorGroupInDashboard;
  virtualMetrics: DashboardColumn[];
  allGroups: IndicatorGroup[];
  onUpdateBinding: (groupId: string, virtualMetricId: string, metricId: string) => void;
  onRemove: () => void;
}