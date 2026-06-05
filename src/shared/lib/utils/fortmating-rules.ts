import { ConditionOperator } from "@/shared/ui/rule-card/types";
import { MetricColor } from "./metric-colors";

export interface FormattingRule {
  id: string;
  operator: ConditionOperator;
  value: number;
  value2?: number;
  color: MetricColor;
}