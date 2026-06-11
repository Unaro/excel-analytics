import type { GroupMetric, MetricTemplate, VirtualMetric } from '@/shared/lib/validators';
import { buildVmIdFromFields } from '@/shared/lib/utils/metric-ids';

/**
 * Строит VirtualMetric из GroupMetric с sourceMetricId.
 *
 * Чистая функция — живёт в entities/, а не в widget/,
 * потому что не имеет React-зависимостей и используется
 * из нескольких виджетов (dashboard-view, group-view).
 */
export function buildVirtualMetric(
  groupId: string,
  metric: GroupMetric,
  template: MetricTemplate | undefined,
  order: number
): VirtualMetric {
  const name =
    (metric.customName && `${metric.customName}(${template?.name})`) ||
    metric.customName ||
    template?.name ||
    'Metric';
  const displayFormat = template?.displayFormat || 'number';
  const decimalPlaces = template?.decimalPlaces || 2;
  // Приоритет у единицы, заданной пользователем для метрики в редакторе
  // группы; suffix/prefix шаблона — запасной вариант. Раньше metric.unit
  // игнорировался, и заданные единицы нигде не отображались.
  const unit = metric.unit || template?.suffix || template?.prefix;
  return {
    id: buildVmIdFromFields(groupId, metric.id, name, displayFormat, decimalPlaces, unit),
    name,
    displayFormat,
    decimalPlaces,
    order: metric.order ?? order,
    unit,
    sourceMetricId: metric.id,
  };
}