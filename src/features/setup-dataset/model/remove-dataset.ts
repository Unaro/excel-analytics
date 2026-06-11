// features/setup-dataset/model/remove-dataset.ts
// ─────────────────────────────────────────────────────────────
// Единая точка полного удаления датасета со всеми артефактами.
//
// До рефакторинга removeDataset из стора удалял только запись стора,
// оставляя сиротами Arrow-буфер в IndexedDB, DuckDB-таблицу в воркере,
// кэш вычислений и конфиги колонок (п.10 аудита — утечка Arrow-буферов).
// ─────────────────────────────────────────────────────────────

import { del } from 'idb-keyval';
import { useDatasetStore } from '@/entities/dataset';
import { useColumnConfigStore } from '@/entities/column-config';
import { duckdbManager } from '@/shared/lib/computation/lib/duckdb/manager';
import { createComputationCache } from '@/shared/lib/storage';

/**
 * Полностью удаляет датасет и все его артефакты:
 * 1. DuckDB-таблицу `dt_<id>` в воркере;
 * 2. Arrow-буфер `arrow:<id>` в IndexedDB;
 * 3. кэш результатов вычислений;
 * 4. конфиги колонок;
 * 5. запись в сторе датасетов.
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
      console.warn('[remove-dataset] Drop table failed (non-critical):', err);
    }

    try {
      await del(`arrow:${datasetId}`);
    } catch (err) {
      console.warn('[remove-dataset] Delete arrow buffer failed:', err);
    }

    try {
      await createComputationCache(entry.sourceType ?? 'file').clear(datasetId);
    } catch (err) {
      console.warn('[remove-dataset] Cache invalidation failed:', err);
    }

    useColumnConfigStore.getState().clearDatasetConfigs(datasetId);
  }

  store.removeDataset(datasetId);
}
