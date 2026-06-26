import { describe, it, expect } from 'vitest';
import { filterConfigBySelection } from './filter-config-selection';
import type { DatasetConfigExportParsed } from '@/shared/lib/validators';
import type { ConfigSelection } from '../model/types';

function cfg(data: Partial<DatasetConfigExportParsed['data']>): DatasetConfigExportParsed {
  return {
    version: 2, exportType: 'dataset_config', exportedAt: 0, sourceDatasetId: 'ds',
    data: { dashboards: [], indicatorGroups: [], hierarchyLevels: [], columnConfigs: [], metricTemplates: [], ...data },
  } as unknown as DatasetConfigExportParsed;
}

const grp = (id: string, templateIds: string[]) => ({
  id, datasetId: 'ds', name: id,
  fieldMappings: [], order: 0, createdAt: 0, updatedAt: 0,
  metrics: templateIds.map((templateId, i) => ({ id: `${id}_m${i}`, templateId, fieldBindings: [], metricBindings: [], enabled: true, order: i })),
});
const tpl = (id: string) => ({ id, name: id, formula: 'SUM(a)', dependencies: [], displayFormat: 'number' as const, decimalPlaces: 0, createdAt: 0, updatedAt: 0 });

const sel = (p: Partial<ConfigSelection>): ConfigSelection => ({
  groupIds: new Set(), templateIds: new Set(), dashboardIds: new Set(), renames: {}, ...p,
});

describe('filterConfigBySelection', () => {
  it('оставляет только выбранные группы', () => {
    const c = cfg({ indicatorGroups: [grp('g1', ['t1']), grp('g2', ['t2'])], metricTemplates: [tpl('t1'), tpl('t2')] });
    const out = filterConfigBySelection(c, sel({ groupIds: new Set(['g1']) }));
    expect(out.data.indicatorGroups.map((g) => g.id)).toEqual(['g1']);
  });

  it('автоматически тянет шаблоны включённых групп (без висячих templateId)', () => {
    const c = cfg({ indicatorGroups: [grp('g1', ['t1'])], metricTemplates: [tpl('t1'), tpl('t2')] });
    const out = filterConfigBySelection(c, sel({ groupIds: new Set(['g1']) }));
    expect(out.data.metricTemplates.map((t) => t.id)).toEqual(['t1']); // t2 не нужен
  });

  it('применяет переименование группы', () => {
    const c = cfg({ indicatorGroups: [grp('g1', [])] });
    const out = filterConfigBySelection(c, sel({ groupIds: new Set(['g1']), renames: { g1: 'Новое имя' } }));
    expect(out.data.indicatorGroups[0].name).toBe('Новое имя');
  });

  it('фильтрует дашборды и groupMetricConfigs по выбору', () => {
    const c = cfg({
      dashboards: [{ id: 'd1', name: 'D1' }, { id: 'd2', name: 'D2' }] as unknown as DatasetConfigExportParsed['data']['dashboards'],
      groupMetricConfigs: { g1: {}, g2: {} },
      indicatorGroups: [grp('g1', [])],
    });
    const out = filterConfigBySelection(c, sel({ groupIds: new Set(['g1']), dashboardIds: new Set(['d1']) }));
    expect((out.data.dashboards as Array<{ id: string }>).map((d) => d.id)).toEqual(['d1']);
    expect(Object.keys(out.data.groupMetricConfigs ?? {})).toEqual(['g1']);
  });

  it('пустое имя в renames игнорируется (остаётся исходное)', () => {
    const c = cfg({ indicatorGroups: [grp('g1', [])] });
    const out = filterConfigBySelection(c, sel({ groupIds: new Set(['g1']), renames: { g1: '   ' } }));
    expect(out.data.indicatorGroups[0].name).toBe('g1');
  });
});
