import { DataItem } from '@/shared/lib/utils/fortmating-rules';
import type { VirtualMetric } from '@/shared/lib/validators';

export interface ChartComponentProps {
  data: DataItem[];
  activeMetricIds: string[];
  metricNames: Record<string, string>;
  axisColor: string;
  virtualMetrics: VirtualMetric[];
  isTimeSeries?: boolean;
}