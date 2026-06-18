// shared/lib/utils/dashboard-columns.ts
// ─────────────────────────────────────────────────────────────
// Колонка дашборда = шаблон метрики (единый источник формата).
//
// Хранимая колонка (VirtualMetric в Dashboard.virtualMetrics) несёт
// templateId + colorConfig + order; имя, формат и единица ВЫВОДЯТСЯ из
// шаблона. Привязка к метрике каждой группы — автоматическая по templateId,
// с опциональным ручным override (для групп с дублем шаблона).
//
// Чистые функции — переиспользуются вычислением (use-dashboard-computation)
// и билдером (MappingRow). Дизайн: задача «формат/привязка в шаблон».
// ─────────────────────────────────────────────────────────────

import type {
  VirtualMetric,
  DashboardColumn,
  IndicatorGroup,
  IndicatorGroupInDashboard,
  MetricTemplate,
  VirtualMetricBindingInDashboard,
} from '@/shared/lib/validators';

/**
 * Определяет шаблон колонки.
 *
 * Для новых колонок — `column.templateId`. Для старых (до перехода на
 * привязку по шаблону) — выводит из существующих привязок: самый частый
 * templateId среди метрик, к которым колонка привязана в группах.
 * Это лениво мигрирует старые дашборды (на следующем сохранении
 * templateId запишется в колонку).
 */
export function resolveColumnTemplateId(
  column: DashboardColumn,
  indicatorGroups: IndicatorGroupInDashboard[],
  groups: IndicatorGroup[]
): string | undefined {
  if (column.templateId) return column.templateId;

  const counts = new Map<string, number>();
  for (const cfg of indicatorGroups) {
    const binding = cfg.virtualMetricBindings?.find(
      (b) => b.virtualMetricId === column.id
    );
    if (!binding) continue;
    const group = groups.find((g) => g.id === cfg.groupId);
    const metric = group?.metrics.find((m) => m.id === binding.metricId);
    if (metric?.templateId) {
      counts.set(metric.templateId, (counts.get(metric.templateId) ?? 0) + 1);
    }
  }

  let best: string | undefined;
  let bestCount = 0;
  for (const [tplId, count] of counts) {
    if (count > bestCount) {
      best = tplId;
      bestCount = count;
    }
  }
  return best;
}

/**
 * «Эффективная» колонка: имя, формат, decimals и единица подставлены
 * из шаблона (colorConfig и прочее — из самой колонки). Такую метрику
 * получает движок и таблица — формат больше не хранится на колонке.
 */
export function buildEffectiveColumn(
  column: DashboardColumn,
  template: MetricTemplate | undefined
): VirtualMetric {
  return {
    id: column.id,
    order: column.order,
    colorConfig: column.colorConfig,
    name: column.name || template?.name || 'Метрика',
    displayFormat: template?.displayFormat ?? column.displayFormat ?? 'number',
    decimalPlaces: template?.decimalPlaces ?? column.decimalPlaces ?? 2,
    unit: template?.unit ?? column.unit,
  };
}

/**
 * Метрика группы, стоящая за колонкой.
 *
 * Override (ручной выбор) приоритетнее, если метрика ещё существует
 * и включена; иначе — первая включённая метрика группы с тем же
 * шаблоном, что у колонки. undefined — в группе нет метрики этого шаблона.
 */
export function resolveColumnMetricId(
  group: IndicatorGroup,
  columnTemplateId: string | undefined,
  overrideMetricId?: string
): string | undefined {
  if (
    overrideMetricId &&
    group.metrics.some((m) => m.id === overrideMetricId && m.enabled)
  ) {
    return overrideMetricId;
  }
  if (!columnTemplateId) return undefined;
  return group.metrics.find(
    (m) => m.enabled && m.templateId === columnTemplateId
  )?.id;
}

/**
 * Материализует привязки `virtualMetricId → metricId` для движка:
 * авто по шаблону + ручные override. Контракт движка не меняется —
 * он получает тот же массив virtualMetricBindings.
 */
export function resolveDashboardGroupsConfig(
  columns: DashboardColumn[],
  indicatorGroups: IndicatorGroupInDashboard[],
  groups: IndicatorGroup[]
): IndicatorGroupInDashboard[] {
  return indicatorGroups.map((cfg) => {
    const group = groups.find((g) => g.id === cfg.groupId);
    if (!group) return cfg;

    const overrides = new Map(
      (cfg.virtualMetricBindings ?? []).map((b) => [b.virtualMetricId, b.metricId])
    );

    const bindings: VirtualMetricBindingInDashboard[] = [];
    for (const col of columns) {
      const templateId = col.templateId;
      const metricId = resolveColumnMetricId(group, templateId, overrides.get(col.id));
      if (metricId) bindings.push({ virtualMetricId: col.id, metricId });
    }

    return { ...cfg, virtualMetricBindings: bindings };
  });
}
