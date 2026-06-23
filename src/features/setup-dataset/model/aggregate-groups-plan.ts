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
import type {
  AggregateTemplateSpec,
  CalculatedTemplateSpec,
} from '@/shared/lib/types/aggregate';

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
  /** Алиасы полей формулы (per-column — один; расчётный — по числу операндов). */
  aliases: string[];
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
  /** Расчётные показатели (многополевые формулы над именами колонок). */
  calculatedSpecs?: CalculatedTemplateSpec[];
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
    calculatedSpecs,
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
  // Per-column шаблон: одна field-переменная (alias), формула из спеки/дефолт.
  const ensurePerColumnTemplate = (name: string): void => {
    if (templatesByName.has(name)) return;
    const spec = specByName.get(name);
    templatesByName.set(name, {
      name,
      formula: spec?.formula ?? DEFAULT_FORMULA,
      aliases: [aliasFor(name)],
      displayFormat: spec?.displayFormat ?? DEFAULT_FORMAT,
      decimalPlaces: spec?.decimalPlaces ?? DEFAULT_DECIMALS,
      unit: spec?.unit,
      normalizeBy: spec?.normalizeBy,
    });
  };
  // Расчётный шаблон: многополевая формула, алиасы = операнды.
  const ensureCalcTemplate = (spec: CalculatedTemplateSpec): void => {
    if (templatesByName.has(spec.name)) return;
    templatesByName.set(spec.name, {
      name: spec.name,
      formula: spec.formula,
      aliases: spec.operands.map(o => o.alias),
      displayFormat: spec.displayFormat,
      decimalPlaces: spec.decimalPlaces,
      unit: spec.unit,
      normalizeBy: spec.normalizeBy,
    });
  };

  const groups: PlannedGroup[] = [];
  let order = 0;
  for (const [groupName, cols] of byGroup) {
    if (exclude.has(groupName)) continue;

    // Per-column метрики: колонка = метрика по одновходовой формуле.
    const perColumn: Omit<PlannedMetric, 'order'>[] = cols
      // Колонки без пользовательского шаблона — только если разрешено.
      .filter(col => importUnassigned || !!metricTemplateNames?.[col.fullName])
      .map(col => {
        // Логический показатель: пользовательский шаблон, иначе имя колонки.
        const templateName = metricTemplateNames?.[col.fullName] || col.name || col.fullName;
        ensurePerColumnTemplate(templateName);
        // Имя метрики = имя колонки; если равно имени шаблона — не дублируем.
        const display = col.name || col.fullName;
        return {
          templateName,
          customName: display && display !== templateName ? display : undefined,
          fieldBindings: [{ fieldAlias: aliasFor(templateName), columnName: col.fullName }],
        };
      });

    // Расчётные метрики: раскрытие по группе — нужны ВСЕ колонки-операнды
    // (по имени) в этой группе; иначе показатель в группе не создаётся.
    const colByName = new Map<string, AggregateColumn>();
    for (const c of cols) if (!colByName.has(c.name)) colByName.set(c.name, c);
    const calculated: Omit<PlannedMetric, 'order'>[] = [];
    for (const spec of calculatedSpecs ?? []) {
      const bindings: PlannedFieldBinding[] = [];
      let resolved = true;
      for (const op of spec.operands) {
        const c = colByName.get(op.columnName);
        if (!c) { resolved = false; break; }
        bindings.push({ fieldAlias: op.alias, columnName: c.fullName });
      }
      if (!resolved) continue; // в этой группе нет всех операндов
      ensureCalcTemplate(spec);
      calculated.push({ templateName: spec.name, fieldBindings: bindings });
    }

    const metrics: PlannedMetric[] = [...perColumn, ...calculated].map((m, i) => ({
      ...m,
      order: i,
    }));
    if (metrics.length === 0) continue; // нечего создавать в группе
    groups.push({ name: groupName, order, metrics });
    order++;
  }

  return { groups, templates: Array.from(templatesByName.values()) };
}
