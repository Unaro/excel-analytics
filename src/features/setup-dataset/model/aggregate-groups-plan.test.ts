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

  it('дефолты без спеки: SUM(value)/number/2, одна field-зависимость value', () => {
    const plan = planAggregateGroups([col('ДОО', 'Потребность')]);
    expect(plan.templates).toEqual([
      {
        name: 'Потребность',
        formula: 'SUM(value)',
        dependencies: [{ alias: 'value', kind: 'field' }],
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
      dependencies: [{ alias: 'v', kind: 'field' }],
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
      { alias: 'a', indicatorName: 'Мощность' },
      { alias: 'b', indicatorName: 'Потребность' },
    ],
    displayFormat: 'percent',
    decimalPlaces: 1,
  };

  it('операнды — материализованные метрики → metricBinding (не поле)', () => {
    const cols = [
      col('ДОО', 'Мощность'), col('ДОО', 'Потребность'),
      col('Школы', 'Мощность'), col('Школы', 'Потребность'),
    ];
    const plan = planAggregateGroups(cols, { calculatedSpecs: [fill] });
    // в каждой группе: 2 per-column + 1 расчётная
    for (const g of plan.groups) {
      const calc = g.metrics.find(m => m.templateName === 'Заполненность')!;
      expect(calc).toBeDefined();
      // Мощность/Потребность — обычные per-column метрики → ссылка на МЕТРИКУ
      expect(calc.metricBindings).toEqual([
        { alias: 'a', metricTemplateName: 'Мощность' },
        { alias: 'b', metricTemplateName: 'Потребность' },
      ]);
      expect(calc.fieldBindings).toEqual([]);
      expect(calc.order).toBe(2); // после двух per-column
    }
    // общий шаблон: обе зависимости — метрики
    const t = plan.templates.find(t => t.name === 'Заполненность')!;
    expect(t.dependencies).toEqual([
      { alias: 'a', kind: 'metric' },
      { alias: 'b', kind: 'metric' },
    ]);
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

  it('операнд по ШАБЛОНУ: у групп РАЗНЫЕ имена колонок под общим показателем', () => {
    // ДОО: «Места»→Мощность, «Спрос»→Потребность; Школы: «Парты»→Мощность, «Заявки»→Потребность
    const cols = [
      col('ДОО', 'Места'), col('ДОО', 'Спрос'),
      col('Школы', 'Парты'), col('Школы', 'Заявки'),
    ];
    const metricTemplateNames = {
      'ДОО · Места': 'Мощность', 'ДОО · Спрос': 'Потребность',
      'Школы · Парты': 'Мощность', 'Школы · Заявки': 'Потребность',
    };
    const plan = planAggregateGroups(cols, { metricTemplateNames, calculatedSpecs: [fill] });
    const doo = plan.groups.find(g => g.name === 'ДОО')!;
    const calc = doo.metrics.find(m => m.templateName === 'Заполненность')!;
    // показатели Мощность/Потребность материализованы → ссылка на метрику
    expect(calc.metricBindings).toEqual([
      { alias: 'a', metricTemplateName: 'Мощность' },
      { alias: 'b', metricTemplateName: 'Потребность' },
    ]);
    // в Школах — те же показатели (свои колонки), тоже как метрики
    const shk = plan.groups.find(g => g.name === 'Школы')!;
    const calcS = shk.metrics.find(m => m.templateName === 'Заполненность')!;
    expect(calcS.metricBindings).toEqual([
      { alias: 'a', metricTemplateName: 'Мощность' },
      { alias: 'b', metricTemplateName: 'Потребность' },
    ]);
  });

  it('служебный шаблон: метрики НЕ создаются, операнды → fieldBinding (колонка)', () => {
    const cols = [col('ДОО', 'Места'), col('ДОО', 'Спрос')];
    const metricTemplateNames = { 'ДОО · Места': 'Мощность', 'ДОО · Спрос': 'Потребность' };
    const plan = planAggregateGroups(cols, {
      metricTemplateNames,
      // оба per-column шаблона служебные → как метрики не выводятся
      templateSpecs: [
        { name: 'Мощность', formula: 'SUM(value)', alias: 'value', displayFormat: 'number', decimalPlaces: 0, serviceOnly: true },
        { name: 'Потребность', formula: 'SUM(value)', alias: 'value', displayFormat: 'number', decimalPlaces: 0, serviceOnly: true },
      ],
      calculatedSpecs: [fill],
    });
    // в группе только расчётная метрика; служебные Мощность/Потребность не выводятся
    expect(plan.groups[0].metrics.map(m => m.templateName)).toEqual(['Заполненность']);
    const calc = plan.groups[0].metrics[0];
    // служебные → привязка к КОЛОНКАМ (поля), не к метрикам
    expect(calc.fieldBindings).toEqual([
      { fieldAlias: 'a', columnName: 'ДОО · Места' },
      { fieldAlias: 'b', columnName: 'ДОО · Спрос' },
    ]);
    expect(calc.metricBindings).toEqual([]);
    // зависимости шаблона — поля (служебные операнды)
    const t = plan.templates.find(t => t.name === 'Заполненность')!;
    expect(t.dependencies).toEqual([
      { alias: 'a', kind: 'field' },
      { alias: 'b', kind: 'field' },
    ]);
    // шаблоны служебных в план не попадают (метрик нет)
    expect(plan.templates.map(t => t.name)).toEqual(['Заполненность']);
  });
});
