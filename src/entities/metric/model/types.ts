// Базовые контракты метрик перенесены в shared/lib/types/metric
// (используются контрактом дашборда и сервисами shared).
// Здесь — ре-экспорт как public API entity.
export type {
  AggregateFunction,
  MetricType,
  DisplayFormat,
  MetricSourceType,
  MetricDependency,
} from '@/shared/lib/types/metric';


// Импортируем и реэкспортируем типы строго из валидаторов
import type {
  MetricTemplate,
  GroupMetric,
  FieldBinding,
  MetricBinding,
  IndicatorGroup
} from '@/shared/lib/validators'; // Актуальный путь

export type {
  MetricTemplate,
  GroupMetric,
  FieldBinding,
  MetricBinding,
  IndicatorGroup
};