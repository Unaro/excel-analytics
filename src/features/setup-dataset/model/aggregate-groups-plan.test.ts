import { describe, it, expect } from 'vitest';
import type { AggregateColumn } from '../lib/aggregate-layout';
import type { AggregateTemplateSpec, CalculatedTemplateSpec } from '@/shared/lib/types/aggregate';
import { planAggregateGroups, NO_GROUP_NAME } from './aggregate-groups-plan';

// ── фикстуры ──────────────────────────────────────────────────
let idx = 0;
function col(
  groupName: string,
  name: string,
  role: AggregateColumn['role'] = 'metric'
): AggregateColumn {
  const fullName = groupName && groupName !== name ? `${groupName} · ${name}` : name;
  return { index: idx++, groupName, name, fullName, role };
}

describe('planAggregateGroups — группировка', () => {
  it('по одной группе на верхний заголовок; ключи/атрибуты игнорируются', () => {
    const cols = [
      col('ДОО', 'Потребность'),
      col('ДОО', 'Мощность'),
      col('Школы', 'Потребность'),
      col('', 'Регион', 'key'),
      col('', 'Тип', 'attribute'),
    ];
    const plan = planAggregateGroups(cols);
    expect(plan.groups.map(g => g.name)).toEqual(['ДОО', 'Школы']);
    expect(plan.groups[0].metrics).toHaveLength(2);
    expect(plan.groups[1].metrics).toHaveLength(1);
  });

  it('колонки без верхнего заголовка → группа NO_GROUP_NAME', () => {
    const plan = planAggregateGroups([col('', 'Площадь')]);
    expect(plan.groups[0].name).toBe(NO_GROUP_NAME);
  });

  it('order групп инкрементится только для непустых/невыключенных', () => {
    const plan = planAggregateGroups(
      [col('A', 'm'), col('B', 'm'), col('C', 'm')],
      { excludeGroups: ['B'] }
    );
    expect(plan.groups.map(g => [g.name, g.order])).toEqual([['A', 0], ['C', 1]]);
  });
});

describe('planAggregateGroups — исключение и importUnassigned', () => {
  it('excludeGroups пропускает группу', () => {
    const plan = planAggregateGroups([col('ДОО', 'Потребность'), col('Школы', 'X')], {
      excludeGroups: ['Школы'],
    });
    expect(plan.groups.map(g => g.name)).toEqual(['ДОО']);
  });

  it('importUnassigned=false: только колонки с пользовательским шаблоном; пустая группа выпадает', () => {
    const cols = [col('ДОО', 'Потребность'), col('ДОО', 'Прочее'), col('Школы', 'Безымянная')];
    const plan = planAggregateGroups(cols, {
      importUnassigned: false,
      metricTemplateNames: { 'ДОО · Потребность': 'Потребность' },
    });
    expect(plan.groups).toHaveLength(1);
    expect(plan.groups[0].name).toBe('ДОО');
    expect(plan.groups[0].metrics.map(m => m.templateName)).toEqual(['Потребность']);
  });
});

describe('planAggregateGroups — имя шаблона, customName, привязки', () => {
  it('templateName: пользовательский переопределяет имя колонки', () => {
    const plan = planAggregateGroups([col('ДОО', 'Кол-во мест')], {
      metricTemplateNames: { 'ДОО · Кол-во мест': 'Мощность' },
    });
    const m = plan.groups[0].metrics[0];
    expect(m.templateName).toBe('Мощность');
    // имя метрики ≠ имя шаблона → customName проставлен
    expect(m.customName).toBe('Кол-во мест');
  });

  it('customName не задаётся, когда имя колонки == имя шаблона', () => {
    const plan = planAggregateGroups([col('ДОО', 'Потребность')]);
    expect(plan.groups[0].metrics[0].customName).toBeUndefined();
  });

  it('fieldBindings: алиас по умолчанию value → fullName колонки', () => {
    const plan = planAggregateGroups([col('ДОО', 'Потребность')]);
    expect(plan.groups[0].metrics[0].fieldBindings).toEqual([
      { fieldAlias: 'value', columnName: 'ДОО · Потребность' },
    ]);
  });
});

describe('planAggregateGroups — шаблоны и спеки', () => {
  const spec = (over: Partial<AggregateTemplateSpec>): AggregateTemplateSpec => ({
    name: 'Потребность',
    formula: 'AVG(v)',
    alias: 'v',
    displayFormat: 'decimal',
    decimalPlaces: 1,
    ...over,
  });

  it('дефолты без спеки: SUM(value)/number/2, aliases [value]', () => {
    const plan = planAggregateGroups([col('ДОО', 'Потребность')]);
    expect(plan.templates).toEqual([
      {
        name: 'Потребность',
        formula: 'SUM(value)',
        aliases: ['value'],
        displayFormat: 'number',
        decimalPlaces: 2,
        unit: undefined,
        normalizeBy: undefined,
      },
    ]);
  });

  it('спека задаёт формулу/формат/алиас; привязка использует alias спеки', () => {
    const plan = planAggregateGroups([col('ДОО', 'Потребность')], {
      templateSpecs: [spec({ unit: 'м²', normalizeBy: 'total' })],
    });
    expect(plan.templates[0]).toMatchObject({
      formula: 'AVG(v)',
      aliases: ['v'],
      displayFormat: 'decimal',
      decimalPlaces: 1,
      unit: 'м²',
      normalizeBy: 'total',
    });
    expect(plan.groups[0].metrics[0].fieldBindings[0].fieldAlias).toBe('v');
  });

  it('шаблон общий: одно имя в разных группах → один шаблон', () => {
    const plan = planAggregateGroups([
      col('ДОО', 'Потребность'),
      col('Школы', 'Потребность'),
    ]);
    expect(plan.templates).toHaveLength(1);
    expect(plan.groups).toHaveLength(2);
  });
});

describe('planAggregateGroups — расчётные показатели (Фаза 1b)', () => {
  const fill: CalculatedTemplateSpec = {
    name: 'Заполненность',
    formula: 'SUM(a)/SUM(b)',
    operands: [
      { alias: 'a', columnName: 'Мощность' },
      { alias: 'b', columnName: 'Потребность' },
    ],
    displayFormat: 'percent',
    decimalPlaces: 1,
  };

  it('раскрывается в каждой группе, где есть все операнды', () => {
    const cols = [
      col('ДОО', 'Мощность'), col('ДОО', 'Потребность'),
      col('Школы', 'Мощность'), col('Школы', 'Потребность'),
    ];
    const plan = planAggregateGroups(cols, { calculatedSpecs: [fill] });
    // в каждой группе: 2 per-column + 1 расчётная
    for (const g of plan.groups) {
      const calc = g.metrics.find(m => m.templateName === 'Заполненность')!;
      expect(calc).toBeDefined();
      expect(calc.fieldBindings).toEqual([
        { fieldAlias: 'a', columnName: `${g.name} · Мощность` },
        { fieldAlias: 'b', columnName: `${g.name} · Потребность` },
      ]);
      expect(calc.order).toBe(2); // после двух per-column
    }
    // один общий шаблон с двумя алиасами
    const t = plan.templates.find(t => t.name === 'Заполненность')!;
    expect(t.aliases).toEqual(['a', 'b']);
    expect(t.formula).toBe('SUM(a)/SUM(b)');
    expect(t.displayFormat).toBe('percent');
  });

  it('группа без всех операндов — расчётная НЕ создаётся', () => {
    const cols = [
      col('ДОО', 'Мощность'), col('ДОО', 'Потребность'),
      col('Школы', 'Мощность'), // нет «Потребность»
    ];
    const plan = planAggregateGroups(cols, { calculatedSpecs: [fill] });
    const doo = plan.groups.find(g => g.name === 'ДОО')!;
    const shk = plan.groups.find(g => g.name === 'Школы')!;
    expect(doo.metrics.some(m => m.templateName === 'Заполненность')).toBe(true);
    expect(shk.metrics.some(m => m.templateName === 'Заполненность')).toBe(false);
  });

  it('группа ТОЛЬКО из расчётной (per-column выключены) всё равно создаётся', () => {
    const cols = [col('ДОО', 'Мощность'), col('ДОО', 'Потребность')];
    const plan = planAggregateGroups(cols, {
      importUnassigned: false, // per-column отсечены (нет metricTemplateNames)
      calculatedSpecs: [fill],
    });
    expect(plan.groups).toHaveLength(1);
    expect(plan.groups[0].metrics.map(m => m.templateName)).toEqual(['Заполненность']);
    expect(plan.groups[0].metrics[0].order).toBe(0);
  });
});
