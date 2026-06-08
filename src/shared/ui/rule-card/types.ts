import { FormattingRule } from "@/shared/lib/utils/fortmating-rules";
import { RenderItemProps } from "../drag-drop-list";

export interface RuleCardProps extends RenderItemProps<FormattingRule> {
  onUpdate: (ruleId: string, updates: Partial<FormattingRule>) => void;
  onRemove: (ruleId: string) => void;
  onDuplicate: (rule: FormattingRule) => void;
  parseNumber: (value: string) => number;
}

export type ConditionOperator = '>' | '>=' | '<' | '<=' | '==' | '!=' | 'between';