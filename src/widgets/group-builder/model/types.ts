import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import type { MetricTemplate } from '@/shared/lib/validators';
import { FormMetricState, useGroupBuilder } from '@/features/group-builder/model/use-group-builder';
import { ColumnConfig } from '@/entities/dataset';

export interface GroupBuilderUIProps {
  builder: ReturnType<typeof useGroupBuilder>;
  mode: 'create' | 'edit';
  onSave: () => void;
}

export interface MetricRowProps {
  item: FormMetricState;
  index: number;
  isDragging: boolean;
  listeners?: SyntheticListenerMap;
  attributes?: DraggableAttributes;
  templates: MetricTemplate[];
  availableColumns: ColumnConfig[];
  selectedMetrics: FormMetricState[];
  onUpdateMetricCustomName: (tempId: string, customName: string) => void;
  onUpdateMetricUnit: (tempId: string, unit: string) => void;
  onUpdateVariableType: (metricTempId: string, alias: string, type: 'field' | 'metric') => void;
  onUpdateBindingValue: (metricTempId: string, alias: string, value: string) => void;
  onRemoveMetric: (tempId: string) => void;
}