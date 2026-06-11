'use client';

import { useDatasetStore } from '@/entities/dataset';
import { useShallow } from 'zustand/react/shallow';

export interface DatasetInfo {
  activeDatasetId: string | null;
  sourceType: 'file' | 'postgres';
  encryptedConnection: string | undefined;
  pgSchema: string | undefined;
  pgTable: string | undefined;
  isSyncing: boolean;
}

/**
 * Селектор, который читает ВСЕ нужные поля активного датасета ОДНОЙ подпиской.
 *
 *   - Единая точка правды для widget-хуков
 */
export function useDatasetInfo(): DatasetInfo {
  return useDatasetStore(useShallow(s => {
    const activeDatasetId = s.activeDatasetId;
    const dataset = activeDatasetId ? s.datasets[activeDatasetId] : undefined;
    return {
      activeDatasetId,
      sourceType: (dataset?.sourceType as 'file' | 'postgres') ?? 'file',
      encryptedConnection: dataset?.pgConfig?.encryptedConnection,
      pgSchema: dataset?.pgConfig?.schema,
      pgTable: dataset?.pgConfig?.table,
      isSyncing: s.isSyncing,
    };
  }));
}