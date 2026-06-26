import { describe, it, expect } from 'vitest';
import { validateConfigAgainstFile } from './validate-config-against-file';
import type { DatasetConfigExportParsed } from '@/shared/lib/validators';
import type { AggregateMatrix } from './file-preview';

/** Минимальный конфиг: тесту важна только секция data. */
function cfg(data: Partial<DatasetConfigExportParsed['data']>): DatasetConfigExportParsed {
  return {
    version: 2,
    exportType: 'dataset_config',
    exportedAt: 0,
    sourceDatasetId: 'ds',
    data: {
      dashboards: [],
      indicatorGroups: [],
      hierarchyLevels: [],
      columnConfigs: [],
      metricTemplates: [],
      ...data,
    },
  } as unknown as DatasetConfigExportParsed;
}

const group = (id: string, fmCols: string[], metricCols: string[][] = []) => ({
  id,
  datasetId: 'ds',
  name: id,
  fieldMappings: fmCols.map((columnName, i) => ({ id: `${id}_fm${i}`, fieldAlias: `a${i}`, columnName })),
  metrics: metricCols.map((cols, mi) => ({
    id: `${id}_m${mi}`,
    templateId: 't',
    fieldBindings: cols.map((columnName, i) => ({ id: `${id}_m${mi}_b${i}`, fieldAlias: `x${i}`, columnName })),
    metricBindings: [],
    enabled: true,
    order: mi,
  })),
  order: 0,
  createdAt: 0,
  updatedAt: 0,
});

const matrixOf = (rows: string[][]): AggregateMatrix => ({ matrix: rows, truncated: false });

describe('validateConfigAgainstFile: сырые данные', () => {
  const opts = (headers: string[]) => ({ headers, aggregateMatrix: null, isAggregate: false });

  it('все колонки на месте → ok', () => {
    const c = cfg({
      indicatorGroups: [group('g1', ['Потребность'], [['Обеспечение']])],
      hierarchyLevels: [{ id: 'l1', columnName: 'Регион', displayName: 'Регион', order: 0 }],
    });
    const r = validateConfigAgainstFile(c, opts(['Регион', 'Потребность', 'Обеспечение']));
    expect(r.ok).toBe(true);
    expect(r.missingColumns).toEqual([]);
  });

  it('ссылка на отсутствующую колонку → missingColumns, ok=false', () => {
    const c = cfg({ indicatorGroups: [group('g1', ['НетТакой'])] });
    const r = validateConfigAgainstFile(c, opts(['Регион', 'Потребность']));
    expect(r.ok).toBe(false);
    expect(r.missingColumns).toContain('НетТакой');
  });

  it('собирает колонки из columnConfigs, уровней и привязок метрик; без дублей', () => {
    const c = cfg({
      columnConfigs: [{ columnName: 'X', classification: 'numeric', alias: 'x', displayName: 'X' }],
      hierarchyLevels: [{ id: 'l', columnName: 'Y', displayName: 'Y', order: 0 }],
      indicatorGroups: [group('g', ['X'], [['Z'], ['Z']])],
    });
    const r = validateConfigAgainstFile(c, opts([]));
    expect(r.missingColumns).toEqual(['X', 'Y', 'Z']); // Z один раз
  });
});

describe('validateConfigAgainstFile: агрегат', () => {
  it('нет aggregateConfig → layoutIssue', () => {
    const c = cfg({});
    const r = validateConfigAgainstFile(c, {
      headers: [],
      aggregateMatrix: matrixOf([['a', 'b']]),
      isAggregate: true,
    });
    expect(r.ok).toBe(false);
    expect(r.layoutIssues.join(' ')).toMatch(/aggregateConfig/);
  });

  it('ключевая колонка за пределами файла → layoutIssue', () => {
    const c = cfg({
      aggregateConfig: { headerRows: 1, keyColumns: [5] } as DatasetConfigExportParsed['data']['aggregateConfig'],
    });
    const r = validateConfigAgainstFile(c, {
      headers: [],
      aggregateMatrix: matrixOf([['Регион', 'Потребность'], ['Город', '10']]),
      isAggregate: true,
    });
    expect(r.layoutIssues.some((i) => i.includes('выходит за пределы'))).toBe(true);
  });

  it('строк шапки не меньше строк файла → layoutIssue', () => {
    const c = cfg({
      aggregateConfig: { headerRows: 3, keyColumns: [0] } as DatasetConfigExportParsed['data']['aggregateConfig'],
    });
    const r = validateConfigAgainstFile(c, {
      headers: [],
      aggregateMatrix: matrixOf([['Регион', 'П'], ['Город', '10']]),
      isAggregate: true,
    });
    expect(r.layoutIssues.some((i) => i.includes('Строк шапки'))).toBe(true);
  });

  it('валидная разметка, группа ссылается на неизвестную колонку → missingColumns', () => {
    const c = cfg({
      aggregateConfig: { headerRows: 1, keyColumns: [0] } as DatasetConfigExportParsed['data']['aggregateConfig'],
      indicatorGroups: [group('g', ['НетКолонки'])],
    });
    const r = validateConfigAgainstFile(c, {
      headers: [],
      aggregateMatrix: matrixOf([['Регион', 'Потребность', 'Обеспечение'], ['Город', '100', '80']]),
      isAggregate: true,
    });
    expect(r.missingColumns).toContain('НетКолонки');
  });

  it('валидная разметка, группа ссылается на колонку из шапки → ok', () => {
    const c = cfg({
      aggregateConfig: { headerRows: 1, keyColumns: [0] } as DatasetConfigExportParsed['data']['aggregateConfig'],
      indicatorGroups: [group('g', ['Потребность'])],
    });
    const r = validateConfigAgainstFile(c, {
      headers: [],
      aggregateMatrix: matrixOf([['Регион', 'Потребность', 'Обеспечение'], ['Город', '100', '80']]),
      isAggregate: true,
    });
    expect(r.ok).toBe(true);
  });
});
