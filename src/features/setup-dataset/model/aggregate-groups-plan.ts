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

/** Привязка алиаса к ДРУГОЙ метрике той же группы (по имени её шаблона). */
export interface PlannedMetricBinding {
  alias: string;
  /** Имя шаблона метрики-операнда в этой же группе (резолв в id при применении). */
  metricTemplateName: string;
}

export interface PlannedMetric {
  /** Логический показатель = имя шаблона. */
  templateName: string;
  /** Имя метрики, если отличается от имени шаблона (иначе не задаём). */
  customName?: string;
  /** Привязки алиасов к колонкам (поля; движок авто-суммирует). */
  fieldBindings: PlannedFieldBinding[];
  /** Привязки алиасов к другим метрикам группы (значение метрики как есть). */
  metricBindings: PlannedMetricBinding[];
  order: number;
}

export interface PlannedGroup {
  name: string;
  order: number;
  metrics: PlannedMetric[];
}

/** Зависимость формулы шаблона: алиас + вид (поле или метрика). */
export interface PlannedDependency {
  alias: string;
  kind: 'field' | 'metric';
}

/** Уникальный (по логическому имени) шаблон, нужный плану. */
export interface PlannedTemplate {
  name: string;
  formula: string;
  /** Зависимости формулы (per-column — одно поле; расчётный — по операндам). */
  dependencies: PlannedDependency[];
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
  // Служебные шаблоны: метрики не создаём, нужны только как операнды расчётных.
  const serviceOnly = new Set<string>();
  for (const s of templateSpecs ?? []) if (s.serviceOnly) serviceOnly.add(s.name);
  // Логический показатель колонки: пользовательский шаблон или имя колонки.
  const indicatorOf = (col: AggregateColumn): string =>
    metricTemplateNames?.[col.fullName] || col.name || col.fullName;

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
      dependencies: [{ alias: aliasFor(name), kind: 'field' }],
      displayFormat: spec?.displayFormat ?? DEFAULT_FORMAT,
      decimalPlaces: spec?.decimalPlaces ?? DEFAULT_DECIMALS,
      unit: spec?.unit,
      normalizeBy: spec?.normalizeBy,
    });
  };
  // Расчётный шаблон: операнд служебного показателя → поле (авто-SUM),
  // обычного → метрика (значение метрики переиспользуется).
  const ensureCalcTemplate = (spec: CalculatedTemplateSpec): void => {
    if (templatesByName.has(spec.name)) return;
    templatesByName.set(spec.name, {
      name: spec.name,
      formula: spec.formula,
      dependencies: spec.operands.map(o => ({
        alias: o.alias,
        kind: serviceOnly.has(o.indicatorName) ? 'field' : 'metric',
      })),
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

    // Логический показатель → колонка этой группы (первая выигрывает).
    // Используется и расчётными операндами (резолв по показателю).
    const indicatorToCol = new Map<string, AggregateColumn>();
    for (const c of cols) {
      const ind = indicatorOf(c);
      if (!indicatorToCol.has(ind)) indicatorToCol.set(ind, c);
    }

    // Per-column метрики: колонка = метрика по одновходовой формуле.
    // Служебные показатели (serviceOnly) в метрики НЕ выводим.
    const perColumn: Omit<PlannedMetric, 'order'>[] = cols
      // Колонки без пользовательского шаблона — только если разрешено.
      .filter(col => importUnassigned || !!metricTemplateNames?.[col.fullName])
      .filter(col => !serviceOnly.has(indicatorOf(col)))
      .map(col => {
        const templateName = indicatorOf(col);
        ensurePerColumnTemplate(templateName);
        // Имя метрики = имя колонки; если равно имени шаблона — не дублируем.
        const display = col.name || col.fullName;
        return {
          templateName,
          customName: display && display !== templateName ? display : undefined,
          fieldBindings: [{ fieldAlias: aliasFor(templateName), columnName: col.fullName }],
          metricBindings: [],
        };
      });

    // Показатели, материализованные как per-column метрики в этой группе
    // (на них расчётные ссылаются как на МЕТРИКУ, а не на колонку).
    const materialized = new Set(perColumn.map(m => m.templateName));

    // Расчётные метрики: раскрытие по группе. Операнд резолвится в колонку
    // (служебный/несматериализованный → fieldBinding, авто-SUM) ИЛИ в метрику
    // группы (обычный показатель → metricBinding, значение метрики как есть).
    const calculated: Omit<PlannedMetric, 'order'>[] = [];
    for (const spec of calculatedSpecs ?? []) {
      const fieldBindings: PlannedFieldBinding[] = [];
      const metricBindings: PlannedMetricBinding[] = [];
      let resolved = true;
      for (const op of spec.operands) {
        const isMetric = !serviceOnly.has(op.indicatorName) && materialized.has(op.indicatorName);
        if (isMetric) {
          metricBindings.push({ alias: op.alias, metricTemplateName: op.indicatorName });
          continue;
        }
        const c = indicatorToCol.get(op.indicatorName);
        if (!c) { resolved = false; break; }
        fieldBindings.push({ fieldAlias: op.alias, columnName: c.fullName });
      }
      if (!resolved) continue; // в этой группе нет всех операндов
      ensureCalcTemplate(spec);
      calculated.push({ templateName: spec.name, fieldBindings, metricBindings });
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
