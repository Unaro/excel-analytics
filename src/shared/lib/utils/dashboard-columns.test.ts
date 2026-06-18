import { describe, it, expect } from 'vitest';
import {
  resolveColumnTemplateId,
  buildEffectiveColumn,
  resolveColumnMetricId,
  resolveDashboardGroupsConfig,
} from './dashboard-columns';
import type {
  DashboardColumn,
  IndicatorGroup,
  IndicatorGroupInDashboard,
  MetricTemplate,
} from '@/shared/lib/validators';

function tpl(over: Partial<MetricTemplate> = {}): MetricTemplate {
  return {
    id: 't1', name: 'Сумма', type: 'aggregate', aggregateFunction: 'SUM',
    aggregateField: 'v', dependencies: [], displayFormat: 'currency',
    decimalPlaces: 2, unit: '₽', createdAt: 0, updatedAt: 0, ...over,
  };
}

function group(over: Partial<IndicatorGroup> = {}): IndicatorGroup {
  return {
    id: 'g1', name: 'Группа', fieldMappings: [], metrics: [], order: 0,
    createdAt: 0, updatedAt: 0, ...over,
  };
}

function metric(id: string, templateId: string, enabled = true) {
  return { id, templateId, fieldBindings: [], metricBindings: [], enabled, order: 0 };
}

describe('buildEffectiveColumn', () => {
  it('подставляет имя, формат, decimals и unit из шаблона', () => {
    const col: DashboardColumn = { id: 'c1', templateId: 't1', order: 0 };
    const eff = buildEffectiveColumn(col, tpl());
    expect(eff.name).toBe('Сумма');
    expect(eff.displayFormat).toBe('currency');
    expect(eff.decimalPlaces).toBe(2);
    expect(eff.unit).toBe('₽');
  });

  it('сохраняет colorConfig и order колонки', () => {
    const col: DashboardColumn = {
      id: 'c1', templateId: 't1', order: 3,
      colorConfig: { rules: [{ id: 'r', operator: '>', value: 1, color: 'rose' }] },
    };
    const eff = buildEffectiveColumn(col, tpl());
    expect(eff.order).toBe(3);
    expect(eff.colorConfig?.rules).toHaveLength(1);
  });
});

describe('resolveColumnMetricId', () => {
  const g = group({ metrics: [metric('m1', 't1'), metric('m2', 't2')] });

  it('авто: первая включённая метрика с тем же шаблоном', () => {
    expect(resolveColumnMetricId(g, 't1')).toBe('m1');
    expect(resolveColumnMetricId(g, 't2')).toBe('m2');
  });

  it('override приоритетнее авто, если метрика существует', () => {
    const g2 = group({ metrics: [metric('m1', 't1'), metric('m3', 't1')] });
    expect(resolveColumnMetricId(g2, 't1')).toBe('m1');          // авто — первая
    expect(resolveColumnMetricId(g2, 't1', 'm3')).toBe('m3');    // override
  });

  it('невалидный override игнорируется → авто', () => {
    expect(resolveColumnMetricId(g, 't1', 'нет-такой')).toBe('m1');
  });

  it('нет метрики шаблона в группе → undefined', () => {
    expect(resolveColumnMetricId(g, 't9')).toBeUndefined();
  });

  it('выключенная метрика не выбирается', () => {
    const g3 = group({ metrics: [metric('m1', 't1', false), metric('m2', 't1', true)] });
    expect(resolveColumnMetricId(g3, 't1')).toBe('m2');
  });
});

describe('resolveColumnTemplateId: ленивая миграция старых колонок', () => {
  const groups = [group({ metrics: [metric('m1', 't1'), metric('m2', 't2')] })];

  it('новая колонка: берёт свой templateId', () => {
    const col: DashboardColumn = { id: 'c1', templateId: 't5', order: 0 };
    expect(resolveColumnTemplateId(col, [], groups)).toBe('t5');
  });

  it('старая колонка: выводит templateId из привязки', () => {
    const col: DashboardColumn = { id: 'c1', order: 0 };
    const dgConfig: IndicatorGroupInDashboard[] = [
      { groupId: 'g1', enabled: true, order: 0,
        virtualMetricBindings: [{ virtualMetricId: 'c1', metricId: 'm2' }] },
    ];
    expect(resolveColumnTemplateId(col, dgConfig, groups)).toBe('t2');
  });

  it('старая колонка без привязок: undefined (ждёт ручного выбора)', () => {
    const col: DashboardColumn = { id: 'c1', order: 0 };
    expect(resolveColumnTemplateId(col, [], groups)).toBeUndefined();
  });
});

describe('resolveDashboardGroupsConfig: материализация привязок для движка', () => {
  const groups = [
    group({ id: 'g1', metrics: [metric('m1', 't1'), metric('m2', 't2')] }),
    group({ id: 'g2', metrics: [metric('m3', 't1')] }),
  ];
  const columns: DashboardColumn[] = [
    { id: 'cA', templateId: 't1', order: 0 },
    { id: 'cB', templateId: 't2', order: 1 },
  ];

  it('каждая группа авто-привязывает колонки по шаблону', () => {
    const cfg: IndicatorGroupInDashboard[] = [
      { groupId: 'g1', enabled: true, order: 0 },
      { groupId: 'g2', enabled: true, order: 1 },
    ];
    const resolved = resolveDashboardGroupsConfig(columns, cfg, groups);
    expect(resolved[0].virtualMetricBindings).toEqual([
      { virtualMetricId: 'cA', metricId: 'm1' },
      { virtualMetricId: 'cB', metricId: 'm2' },
    ]);
    // g2 не имеет шаблона t2 → только колонка cA привязана
    expect(resolved[1].virtualMetricBindings).toEqual([
      { virtualMetricId: 'cA', metricId: 'm3' },
    ]);
  });
});
