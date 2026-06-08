// shared/lib/services/column-config-merger.ts
// ─────────────────────────────────────────────────────────────
// Чистая функция мержа конфигов колонок при замене файла датасета.
//
// НЕ импортирует Zustand-сторы — принимает данные через параметры.
// Это делает её тестируемой без моков React и переиспользуемой
// из любых слоёв (features, widgets, server-actions).
// ─────────────────────────────────────────────────────────────

import type { ColumnConfig } from '@/shared/lib/types/dataset';

// ─────────────────────────────────────────────────────────────
// Публичные типы
// ─────────────────────────────────────────────────────────────

export interface ColumnConfigMergeResult {
  /** Итоговые конфиги после мержа */
  mergedConfigs: ColumnConfig[];
  /** Имена колонок, которые появились в новом файле */
  addedColumns: string[];
  /** Имена колонок, которые исчезли из нового файла */
  removedColumns: string[];
}

// ─────────────────────────────────────────────────────────────
// Публичная функция
// ─────────────────────────────────────────────────────────────

/**
 * Мержит новые auto-detected конфиги с сохранёнными пользовательскими настройками.
 *
 * Ключевые принципы (совместимы с replaceDatasetFile):
 *   1. ID датасета НЕ меняется — связи с дашбордами/группами сохраняются
 *   2. Существующие колонки сохраняют classification/alias/displayName
 *   3. Удалённые колонки НЕ удаляются, а помечаются как 'ignore'
 *      (метрики дашбордов не падают, а показывают "колонка не найдена")
 *   4. Новые колонки получают auto-классификацию из нового файла
 *
 * @param oldConfigs - сохранённые конфиги (из columnConfigStore)
 * @param newAutoConfigs - новые auto-detected конфиги (из DuckDB worker)
 */
export function mergeColumnConfigs(
  oldConfigs: ColumnConfig[],
  newAutoConfigs: ColumnConfig[]
): ColumnConfigMergeResult {
  const oldConfigMap = new Map(oldConfigs.map((c) => [c.columnName, c]));
  const oldColumnNames = new Set(oldConfigs.map((c) => c.columnName));
  const newColumnNames = new Set(newAutoConfigs.map((c) => c.columnName));

  // ─── 1. Определяем добавленные/удалённые колонки ───────────
  const addedColumns = newAutoConfigs
    .map((c) => c.columnName)
    .filter((name) => !oldColumnNames.has(name));

  const removedColumns = Array.from(oldColumnNames).filter(
    (name) => !newColumnNames.has(name)
  );

  // ─── 2. Мержим существующие + новые с сохранением настроек ─
  const mergedFromNew: ColumnConfig[] = newAutoConfigs.map((newCfg) => {
    const oldCfg = oldConfigMap.get(newCfg.columnName);
    if (oldCfg) {
      return {
        ...newCfg,
        classification: oldCfg.classification,
        alias: oldCfg.alias,
        displayName: oldCfg.displayName,
        description: oldCfg.description || newCfg.description,
      };
    }
    return newCfg;
  });

  // ─── 3. Помечаем удалённые как 'ignore' ────────────────────
  const removedAsIgnored: ColumnConfig[] = removedColumns.map((name) => {
    const oldCfg = oldConfigMap.get(name)!;
    return {
      ...oldCfg,
      classification: 'ignore' as const,
      description: `[КОЛОНКА УДАЛЕНА ИЗ ФАЙЛА] ${oldCfg.description || ''}`.trim(),
    };
  });

  return {
    mergedConfigs: [...mergedFromNew, ...removedAsIgnored],
    addedColumns,
    removedColumns,
  };
}