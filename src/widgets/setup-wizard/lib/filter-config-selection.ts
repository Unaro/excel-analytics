// widgets/setup-wizard/lib/filter-config-selection.ts
// ─────────────────────────────────────────────────────────────
// Фильтрация распарсенного конфига по выбору пользователя перед импортом
// «готовой конфигурации»: оставить выбранные группы/дашборды, применить
// переименования. Шаблоны метрик, на которые ссылаются включённые группы,
// сохраняются автоматически (иначе у метрик были бы висячие templateId).
// Чистая функция — тестируется отдельно.
// ─────────────────────────────────────────────────────────────

import type { DatasetConfigExportParsed } from '@/shared/lib/validators';
import type { ConfigSelection } from '../model/types';

/** Имя из renames (если задано непустым), иначе исходное. */
function renamed(id: string, fallback: string, renames: Record<string, string>): string {
  const r = renames[id];
  return r && r.trim() ? r.trim() : fallback;
}

export function filterConfigBySelection(
  parsed: DatasetConfigExportParsed,
  selection: ConfigSelection
): DatasetConfigExportParsed {
  const { data } = parsed;
  const { groupIds, templateIds, dashboardIds, renames } = selection;

  const keptGroups = (data.indicatorGroups ?? [])
    .filter((g) => groupIds.has(g.id))
    .map((g) => ({ ...g, name: renamed(g.id, g.name, renames) }));

  // Шаблоны: явно выбранные + те, на которые ссылаются включённые группы.
  const neededTemplateIds = new Set(templateIds);
  for (const g of keptGroups) {
    for (const m of g.metrics ?? []) neededTemplateIds.add(m.templateId);
  }
  const keptTemplates = (data.metricTemplates ?? []).filter((t) => neededTemplateIds.has(t.id));

  const keptDashboards = ((data.dashboards ?? []) as Array<Record<string, unknown>>)
    .filter((d) => typeof d.id === 'string' && dashboardIds.has(d.id))
    .map((d) => ({ ...d, name: renamed(d.id as string, (d.name as string) ?? '', renames) }));

  const keptGroupConfigs = data.groupMetricConfigs
    ? Object.fromEntries(
        Object.entries(data.groupMetricConfigs).filter(([gid]) => groupIds.has(gid))
      )
    : data.groupMetricConfigs;

  return {
    ...parsed,
    data: {
      ...data,
      indicatorGroups: keptGroups,
      metricTemplates: keptTemplates,
      dashboards: keptDashboards,
      groupMetricConfigs: keptGroupConfigs,
    },
  };
}
