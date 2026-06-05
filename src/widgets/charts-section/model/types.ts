import type { VirtualMetric } from '@/shared/lib/validators';

export interface ChartDataItem {
  name: string;
  [key: string]: string | number;
}

export interface ChartComponentProps {
  data: ChartDataItem[];
  activeMetricIds: string[];
  metricNames: Record<string, string>;
  axisColor: string;
  virtualMetrics: VirtualMetric[];
  isTimeSeries?: boolean;
}