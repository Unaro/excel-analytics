import { ChartType } from "@/shared/lib/types/chart";

export interface DashboardViewState {
  activeMetricIds: string[];
  chartTypes: ChartType[];
  hiddenMetricIds: string[];
  setActiveMetricIds: (ids: string[]) => void;
  setChartTypes: (types: ChartType[]) => void;
  toggleMetricVisibility: (id: string) => void;
}