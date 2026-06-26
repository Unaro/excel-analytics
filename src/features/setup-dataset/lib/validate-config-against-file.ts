// features/setup-dataset/lib/validate-config-against-file.ts
// ─────────────────────────────────────────────────────────────
// Семантическая сверка «готового» конфига с реальным файлом перед импортом.
//
// Zod-валидность структуры конфига проверяет config-import-service
// (validateConfigStructure). Здесь — соответствие СОДЕРЖИМОГО файлу: есть ли
// колонки, на которые ссылаются группы/метрики/уровни (сырые), и сходится ли
// разметка агрегата с размерами матрицы. Не блокирует импорт — отдаёт список
// проблем для предупреждения (применить частично / отменить решает пользователь).
// ─────────────────────────────────────────────────────────────

import type { DatasetConfigExportParsed } from '@/shared/lib/validators';
import type { AggregateMatrix } from './file-preview';
import { buildColumns } from './aggregate-layout';

export interface ConfigFileValidation {
  /** Колонки, на которые ссылается конфиг, но которых нет в файле. */
  missingColumns: string[];
  /** Проблемы разметки агрегата (границы шапки/ключевых колонок и т.п.). */
  layoutIssues: string[];
  /** Нет ни одной проблемы. */
  ok: boolean;
}

interface ValidateOptions {
  /** Заголовки колонок файла (для сырых данных). */
  headers: string[];
  /** Сырая матрица файла (для агрегата). */
  aggregateMatrix: AggregateMatrix | null;
  /** Режим файла-агрегата. */
  isAggregate: boolean;
}

/** Уникальные непустые строки с сохранением порядка. */
function uniq(values: Iterable<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (v && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

/** Колонки, на которые ссылается data конфига (для сырых данных). */
function referencedColumns(data: DatasetConfigExportParsed['data']): string[] {
  const refs: string[] = [];
  for (const c of data.columnConfigs ?? []) refs.push(c.columnName);
  for (const lvl of data.hierarchyLevels ?? []) refs.push(lvl.columnName);
  for (const g of data.indicatorGroups ?? []) {
    for (const fm of g.fieldMappings ?? []) refs.push(fm.columnName);
    for (const m of g.metrics ?? []) {
      for (const fb of m.fieldBindings ?? []) refs.push(fb.columnName);
    }
  }
  return uniq(refs);
}

/**
 * Сверяет конфиг с файлом. Для сырых — наличие колонок-ссылок в заголовках.
 * Для агрегата — наличие разметки и её соответствие размерам матрицы, плюс
 * best-effort сверка метрик-колонок групп с колонками, выведенными из шапки.
 */
export function validateConfigAgainstFile(
  parsed: DatasetConfigExportParsed,
  { headers, aggregateMatrix, isAggregate }: ValidateOptions
): ConfigFileValidation {
  const { data } = parsed;
  const missingColumns: string[] = [];
  const layoutIssues: string[] = [];

  if (isAggregate) {
    const layout = data.aggregateConfig;
    if (!layout) {
      layoutIssues.push('Конфиг не содержит разметку агрегата (aggregateConfig).');
    } else if (aggregateMatrix) {
      const matrix = aggregateMatrix.matrix;
      const width = matrix.reduce((m, r) => Math.max(m, r.length), 0);
      const keyColumns = layout.keyColumns ?? [];

      if (keyColumns.length === 0) {
        layoutIssues.push('В разметке агрегата не заданы ключевые колонки.');
      }
      const maxKey = keyColumns.length ? Math.max(...keyColumns) : -1;
      if (maxKey >= width) {
        layoutIssues.push(
          `Ключевая колонка №${maxKey + 1} выходит за пределы файла (${width} колонок).`
        );
      }
      if (layout.headerRows < 1) {
        layoutIssues.push('Число строк шапки в разметке меньше 1.');
      }
      if (layout.headerRows >= matrix.length) {
        layoutIssues.push(
          `Строк шапки (${layout.headerRows}) не меньше, чем строк в превью файла (${matrix.length}).`
        );
      }

      // Best-effort: метрики-колонки, на которые ссылаются группы, должны быть
      // среди колонок, выведенных из шапки. Считаем только при валидных границах.
      if (maxKey < width && layout.headerRows >= 1 && layout.headerRows < matrix.length) {
        const headerMatrix = matrix.slice(0, layout.headerRows);
        const dataRows = matrix.slice(layout.headerRows);
        const cols = buildColumns(headerMatrix, keyColumns, dataRows, layout.empty);
        const known = new Set(cols.map((c) => c.fullName).concat(cols.map((c) => c.name)));
        for (const g of data.indicatorGroups ?? []) {
          for (const fm of g.fieldMappings ?? []) {
            if (fm.columnName && !known.has(fm.columnName)) missingColumns.push(fm.columnName);
          }
          for (const m of g.metrics ?? []) {
            for (const fb of m.fieldBindings ?? []) {
              if (fb.columnName && !known.has(fb.columnName)) missingColumns.push(fb.columnName);
            }
          }
        }
      }
    }
  } else {
    const headerSet = new Set(headers);
    for (const col of referencedColumns(data)) {
      if (!headerSet.has(col)) missingColumns.push(col);
    }
  }

  const missing = uniq(missingColumns);
  return {
    missingColumns: missing,
    layoutIssues,
    ok: missing.length === 0 && layoutIssues.length === 0,
  };
}
