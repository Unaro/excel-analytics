import { describe, it, expect } from 'vitest';
import { buildConfigExportPayload } from './config-export-service';
import { processConfigImport } from './config-import-service';
import type { AggregateLayoutConfig } from '@/shared/lib/types/aggregate';

/**
 * Разметка агрегата должна переживать экспорт→импорт конфига — иначе на другой
 * машине замена файла агрегата не сможет переиспользовать настройки чтения.
 */
const emptyContext = {
  dashboards: [],
  indicatorGroups: [],
  hierarchyLevels: [],
  columnConfigs: [],
  metricTemplates: [],
  groupMetricConfigs: {},
};

const importContext = {
  existingMetricTemplates: [],
  existingIndicatorGroups: [],
  existingDashboards: [],
  existingVmIds: new Set<string>(),
};

describe('config export/import: aggregateConfig round-trip', () => {
  it('переносит разметку агрегата через экспорт → импорт', async () => {
    const aggregateConfig: AggregateLayoutConfig = {
      headerRows: 2,
      keyColumns: [0, 1],
      empty: { tokens: ['—'] },
      excludeGroups: ['Служебное'],
      metricTemplateNames: { 'Группа · Потребность': 'Потребность' },
      importUnassignedMetrics: false,
    };

    const { blob } = buildConfigExportPayload(
      { datasetId: 'ds1', ...emptyContext, aggregateConfig },
      'ds1'
    );
    const result = processConfigImport(await blob.text(), {
      targetDatasetId: 'ds2',
      ...importContext,
    });

    expect(result.aggregateConfig).toEqual(aggregateConfig);
  });

  it('конфиг без агрегата → aggregateConfig отсутствует', async () => {
    const { blob } = buildConfigExportPayload(
      { datasetId: 'ds1', ...emptyContext },
      'ds1'
    );
    const result = processConfigImport(await blob.text(), {
      targetDatasetId: 'ds2',
      ...importContext,
    });

    expect(result.aggregateConfig).toBeUndefined();
  });
});
