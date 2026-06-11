import { IndicatorGroup } from "@/entities/metric";
import { IndicatorGroupInDashboard, VirtualMetric } from "@/shared/lib/validators";

export interface GroupAdderProps {
  availableGroups: IndicatorGroup[];
  dashboardGroups: IndicatorGroupInDashboard[];
  onAdd: (groupId: string) => void;
}

export interface MappingRowProps {
  groupConfig: IndicatorGroupInDashboard;
  virtualMetrics: VirtualMetric[];
  allGroups: IndicatorGroup[];
  onUpdateBinding: (groupId: string, virtualMetricId: string, metricId: string) => void;
  onRemove: () => void;
}