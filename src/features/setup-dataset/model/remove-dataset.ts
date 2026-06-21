// features/setup-dataset/model/remove-dataset.ts
// ─────────────────────────────────────────────────────────────
// Единая точка полного удаления датасета со всеми артефактами.
//
// До рефакторинга removeDataset из стора удалял только запись стора,
// оставляя сиротами Arrow-буфер в IndexedDB, DuckDB-таблицу в воркере,
// кэш вычислений и конфиги колонок (п.10 аудита — утечка Arrow-буферов).
// ─────────────────────────────────────────────────────────────

import { logger } from '@/shared/lib/logger';
import { del } from 'idb-keyval';
import { useDatasetStore } from '@/entities/dataset';
import { useColumnConfigStore } from '@/entities/column-config';
import { useHierarchyStore } from '@/entities/hierarchy';
import { useAggregateNodesStore } from '@/entities/aggregate-nodes';
import { duckdbManager } from '@/shared/lib/computation/lib/duckdb/manager';
import { createComputationCache } from '@/shared/lib/storage';

/**
 * Полностью удаляет датасет и все его артефакты:
 * 1. DuckDB-таблицу `dt_<id>` в воркере;
 * 2. Arrow-буфер `arrow:<id>` в IndexedDB;
 * 3. кэш результатов вычислений;
 * 4. конфиги колонок;
 * 5. уровни иерархии датасета;
 * 6. запись в сторе датасетов.
 *
 * Ошибки очистки артефактов не блокируют удаление записи —
 * каждая ступень изолирована (артефакт-сирота хуже, чем
 * недоудалённый кэш, который перезапишется).
 */
export async function removeDatasetCompletely(datasetId: string): Promise<void> {
  const store = useDatasetStore.getState();
  const entry = store.datasets[datasetId];

  if (entry) {
    try {
      await duckdbManager.dropTable(datasetId);
    } catch (err) {
      logger.warn('[remove-dataset] Drop table failed (non-critical):', err);
    }

    try {
      await del(`arrow:${datasetId}`);
    } catch (err) {
      logger.warn('[remove-dataset] Delete arrow buffer failed:', err);
    }

    try {
      await createComputationCache(entry.sourceType ?? 'file').clear(datasetId);
    } catch (err) {
      logger.warn('[remove-dataset] Cache invalidation failed:', err);
    }

    useColumnConfigStore.getState().clearDatasetConfigs(datasetId);

    // Уровни иерархии привязаны к колонкам удаляемых данных — без очистки
    // они копились бы в persist как orphan-записи (п.8 аудита ядра).
    // Группы и дашборды сохраняются намеренно (см. текст диалога удаления).
    useHierarchyStore.getState().clearDatasetLevels(datasetId);

    // Введённые значения узлов агрегата — тоже orphan без очистки (фаза 2).
    useAggregateNodesStore.getState().clearNodes(datasetId);
  }

  store.removeDataset(datasetId);
}
