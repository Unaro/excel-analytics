import { IndicatorGroup, IndicatorGroupInDashboard, MetricTemplate, VirtualMetric } from "../validators";

/**
 * Генерирует детерминированный хеш для массива фильтров иерархии.
 * 
 */
export function generateFiltersHash(
  filters: { levelId: string; value: string }[]
): string {
  if (filters.length === 0) return 'empty';

  // 1. Сортируем для детерминированности (порядок фильтров не важен)
  const sorted = [...filters].sort((a, b) => a.levelId.localeCompare(b.levelId));
  const str = JSON.stringify(sorted);

  // 2. djb2-подобная хеш-функция (работает с любыми char codes)
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0;
  }

  // 3. Возвращаем base36 строку (компактно и URL-safe)
  return 'h' + Math.abs(hash).toString(36);
}

/**
 * Генерирует составной ключ кеша для вычислений.
 * Объединяет datasetId, dashboardId и filtersHash в одну строку.
 */
export function buildCacheKey(params: {
  datasetId: string;
  dashboardId: string;
  filtersHash: string;
}): string {
  return `${params.datasetId}|${params.dashboardId}|${params.filtersHash}`;
}

/**
 * Генерирует хеш конфигурации дашборда (группы + шаблоны + bindings).
 * Используется для:
 *  1. Детекции изменений — когда нужно пересчитать дашборд
 *  2. Ключа кэша — чтобы не возвращать устаревшие результаты
 * 
 * Включаем в хеш:
 *  - groups: состав метрик и их bindings (fieldBindings + metricBindings)
 *  - metricTemplates: определения формул и агрегаций
 *  - dashboardGroupsConfig: какие группы включены + virtualMetricBindings
 *  - virtualMetrics: колонки таблицы дашборда
 */
export function generateConfigHash(params: {
  groups: IndicatorGroup[];
  metricTemplates: MetricTemplate[];
  dashboardGroupsConfig: IndicatorGroupInDashboard[];
  virtualMetrics: VirtualMetric[];
}): string {
  // Детерминированная сериализация (сортировка по id)
  const sortedGroups = [...params.groups].sort((a, b) => a.id.localeCompare(b.id));
  const sortedTemplates = [...params.metricTemplates].sort((a, b) => a.id.localeCompare(b.id));
  const sortedDashGroups = [...params.dashboardGroupsConfig].sort((a, b) => a.groupId.localeCompare(b.groupId));
  const sortedVms = [...params.virtualMetrics].sort((a, b) => a.id.localeCompare(b.id));

  const payload = {
    g: sortedGroups.map(g => ({
      id: g.id,
      m: g.metrics.map(m => ({
        id: m.id,
        tpl: m.templateId,
        en: m.enabled,
        fb: m.fieldBindings.map(f => `${f.fieldAlias}→${f.columnName}`).sort(),
        mb: m.metricBindings.map(b => `${b.metricAlias}→${b.metricId}`).sort(),
      })),
    })),
    t: sortedTemplates.map(t => ({
      id: t.id,
      f: t.formula,
    })),
    dg: sortedDashGroups.map(dg => ({
      id: dg.groupId,
      en: dg.enabled,
      vmb: (dg.virtualMetricBindings || []).map(b => `${b.virtualMetricId}→${b.metricId}`).sort(),
    })),
    vm: sortedVms.map(v => v.id),
  };

  const str = JSON.stringify(payload);

  // djb2 хеш (тот же что и в generateFiltersHash)
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return 'c' + Math.abs(hash).toString(36);
}