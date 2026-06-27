import { describe, it, expect } from 'vitest';
import { buildConfigExportPayload } from './config-export-service';
import { processConfigImport } from './config-import-service';
import type { IndicatorGroup, MetricTemplate } from '@/shared/lib/validators';
import type { Dashboard } from '@/shared/lib/types/dashboard';

// ── минимальные фикстуры (экспорт/импорт читают лишь часть полей) ─────────
function tpl(id: string, name: string, formula: string): MetricTemplate {
  return {
    id, name, formula,
    dependencies: [],
    displayFormat: 'number',
    decimalPlaces: 0,
    createdAt: 0,
    updatedAt: 0,
  };
}
function group(id: string, datasetId: string, templateIds: string[]): IndicatorGroup {
  return {
    id, datasetId, name: id,
    fieldMappings: [],
    metrics: templateIds.map((templateId, i) => ({
      id: `${id}-m${i}`, templateId,
      fieldBindings: [], metricBindings: [],
      enabled: true, order: i,
    })),
    order: 0,
    createdAt: 0,
    updatedAt: 0,
  };
}
function dashboard(id: string, datasetId: string, colTemplateIds: string[]): Dashboard {
  return {
    id, datasetId, name: id,
    virtualMetrics: colTemplateIds.map((templateId, i) => ({ id: `${id}-c${i}`, templateId, order: i })),
    hierarchyFilters: [],
    indicatorGroups: [],
    widgets: [],
    kpiWidgets: [],
    isPublic: false,
    createdAt: 0,
    updatedAt: 0,
  };
}

const baseCtx = {
  hierarchyLevels: [],
  columnConfigs: [],
  groupMetricConfigs: {},
};

describe('export: только задействованные шаблоны', () => {
  it('выгружает шаблоны из метрик групп и колонок дашбордов, прочие — отбрасывает', () => {
    const templates = [tpl('t1', 'A', 'SUM(a)'), tpl('t2', 'B', 'SUM(b)'), tpl('t3', 'Unused', 'SUM(c)')];
    const groups = [group('g1', 'ds1', ['t1'])];
    const dashboards = [dashboard('d1', 'ds1', ['t2'])];

    const { blob, stats } = buildConfigExportPayload(
      { datasetId: 'ds1', ...baseCtx, metricTemplates: templates, indicatorGroups: groups, dashboards },
      'ds1'
    );
    expect(stats.templatesCount).toBe(2);
    return blob.text().then((txt) => {
      const ids = JSON.parse(txt).data.metricTemplates.map((t: MetricTemplate) => t.id).sort();
      expect(ids).toEqual(['t1', 't2']); // t3 (Unused) отброшен
    });
  });
});

describe('import: дедуп шаблонов по имени+формуле с ремаппингом ссылок', () => {
  it('шаблон с тем же именем+формулой, но другим id — переиспуется, ссылки переназначаются', () => {
    const templates = [tpl('imp-t1', 'Потребность', 'SUM(x)')];
    const groups = [group('g1', 'ds1', ['imp-t1'])];
    const dashboards = [dashboard('d1', 'ds1', ['imp-t1'])];
    const { blob } = buildConfigExportPayload(
      { datasetId: 'ds1', ...baseCtx, metricTemplates: templates, indicatorGroups: groups, dashboards },
      'ds1'
    );

    return blob.text().then((txt) => {
      const result = processConfigImport(txt, {
        targetDatasetId: 'ds2',
        // в целевом датасете уже есть тот же логический шаблон, но с другим id
        existingMetricTemplates: [tpl('exist-t1', 'Потребность', 'SUM(x)')],
        existingIndicatorGroups: [],
        existingDashboards: [],
        existingVmIds: new Set<string>(),
      });

      // импортный шаблон НЕ добавляется (смысловой дубль)
      expect(result.newMetricTemplates).toHaveLength(0);
      // ссылки групп переназначены на существующий id
      const importedGroup = result.mergedIndicatorGroups.find((g) => g.id === 'g1')!;
      expect(importedGroup.metrics[0].templateId).toBe('exist-t1');
      // ссылки колонок дашборда переназначены
      const importedDash = result.mergedDashboards.find((d) => d.id === 'd1')!;
      expect(importedDash.virtualMetrics[0].templateId).toBe('exist-t1');
    });
  });

  it('новый шаблон (нет совпадения) — добавляется как есть', () => {
    const templates = [tpl('imp-t1', 'Новая', 'SUM(y)')];
    const groups = [group('g1', 'ds1', ['imp-t1'])];
    const { blob } = buildConfigExportPayload(
      { datasetId: 'ds1', ...baseCtx, metricTemplates: templates, indicatorGroups: groups, dashboards: [] },
      'ds1'
    );
    return blob.text().then((txt) => {
      const result = processConfigImport(txt, {
        targetDatasetId: 'ds2',
        existingMetricTemplates: [tpl('exist-t1', 'Другая', 'SUM(z)')],
        existingIndicatorGroups: [],
        existingDashboards: [],
        existingVmIds: new Set<string>(),
      });
      expect(result.newMetricTemplates.map((t) => t.id)).toEqual(['imp-t1']);
      const importedGroup = result.mergedIndicatorGroups.find((g) => g.id === 'g1')!;
      expect(importedGroup.metrics[0].templateId).toBe('imp-t1');
    });
  });
});
