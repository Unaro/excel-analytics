// ─────────────────────────────────────────────────────────────
// Чистое планирование групп/шаблонов/метрик из колонок-агрегата.
//
// Вынесено из createAggregateGroups (sync-engine) ради тестируемости: здесь —
// ТОЛЬКО решение «какие группы, метрики, шаблоны и привязки получаются из
// разметки» (без сторов и id). Применение плана к сторам (reuse-or-create
// шаблона по имени+формуле, addGroup) осталось в sync-engine тонкой обёрткой.
// Ядро единого импорта (architecture/unified-import.md, Фаза 0).
// ─────────────────────────────────────────────────────────────

import type { AggregateColumn } from '../lib/aggregate-layout';
import type { AggregateTemplateSpec } from '@/shared/lib/types/aggregate';

const DEFAULT_FORMULA = 'SUM(value)';
const DEFAULT_ALIAS = 'value';
const DEFAULT_FORMAT = 'number';
const DEFAULT_DECIMALS = 2;
/** Имя группы для колонок без верхнего заголовка шапки. */
export const NO_GROUP_NAME = '(без группы)';

export interface PlannedFieldBinding {
  fieldAlias: string;
  columnName: string;
}

export interface PlannedMetric {
  /** Логический показатель = имя шаблона. */
  templateName: string;
  /** Имя метрики, если отличается от имени шаблона (иначе не задаём). */
  customName?: string;
  fieldBindings: PlannedFieldBinding[];
  order: number;
}

export interface PlannedGroup {
  name: string;
  order: number;
  metrics: PlannedMetric[];
}

/** Уникальный (по логическому имени) шаблон, нужный плану. */
export interface PlannedTemplate {
  name: string;
  formula: string;
  alias: string;
  displayFormat: string;
  decimalPlaces: number;
  unit?: string;
  normalizeBy?: string;
}

export interface AggregateGroupsPlan {
  groups: PlannedGroup[];
  templates: PlannedTemplate[];
}

export interface PlanAggregateGroupsOptions {
  /** Имена групп, снятых пользователем (пропустить). */
  excludeGroups?: string[];
  /** fullName колонки → имя логического показателя (= имя шаблона). */
  metricTemplateNames?: Record<string, string>;
  /** Импортировать колонки без пользовательского шаблона (по умолчанию да). */
  importUnassigned?: boolean;
  /** Спеки шаблонов (формула/формат/алиас), заданные при импорте. */
  templateSpecs?: AggregateTemplateSpec[];
}

/**
 * Планирует группы, метрики и шаблоны из колонок-мер агрегата.
 * По одной группе на верхний заголовок шапки (groupName); шаблон — общий на
 * логический показатель (имя), переиспользуется во всех группах.
 */
export function planAggregateGroups(
  columns: AggregateColumn[],
  options: PlanAggregateGroupsOptions = {}
): AggregateGroupsPlan {
  const {
    excludeGroups,
    metricTemplateNames,
    importUnassigned = true,
    templateSpecs,
  } = options;

  const specByName = new Map<string, AggregateTemplateSpec>();
  for (const s of templateSpecs ?? []) specByName.set(s.name, s);
  const aliasFor = (name: string): string => specByName.get(name)?.alias ?? DEFAULT_ALIAS;

  // Колонки-меры сгруппированы по верхнему заголовку (groupName).
  const byGroup = new Map<string, AggregateColumn[]>();
  for (const col of columns) {
    if (col.role !== 'metric') continue;
    const key = col.groupName || NO_GROUP_NAME;
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key)!.push(col);
  }

  const exclude = new Set(excludeGroups ?? []);
  const templatesByName = new Map<string, PlannedTemplate>();
  const ensureTemplate = (name: string): void => {
    if (templatesByName.has(name)) return;
    const spec = specByName.get(name);
    templatesByName.set(name, {
      name,
      formula: spec?.formula ?? DEFAULT_FORMULA,
      alias: aliasFor(name),
      displayFormat: spec?.displayFormat ?? DEFAULT_FORMAT,
      decimalPlaces: spec?.decimalPlaces ?? DEFAULT_DECIMALS,
      unit: spec?.unit,
      normalizeBy: spec?.normalizeBy,
    });
  };

  const groups: PlannedGroup[] = [];
  let order = 0;
  for (const [groupName, cols] of byGroup) {
    if (exclude.has(groupName)) continue;
    const metrics: PlannedMetric[] = cols
      // Колонки без пользовательского шаблона — только если разрешено.
      .filter(col => importUnassigned || !!metricTemplateNames?.[col.fullName])
      .map((col, i) => {
        // Логический показатель: пользовательский шаблон, иначе имя колонки.
        const templateName = metricTemplateNames?.[col.fullName] || col.name || col.fullName;
        ensureTemplate(templateName);
        // Имя метрики = имя колонки; если равно имени шаблона — не дублируем.
        const display = col.name || col.fullName;
        return {
          templateName,
          customName: display && display !== templateName ? display : undefined,
          fieldBindings: [{ fieldAlias: aliasFor(templateName), columnName: col.fullName }],
          order: i,
        };
      });
    if (metrics.length === 0) continue; // все колонки без шаблона, импорт выключен
    groups.push({ name: groupName, order, metrics });
    order++;
  }

  return { groups, templates: Array.from(templatesByName.values()) };
}
