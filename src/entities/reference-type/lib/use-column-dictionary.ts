'use client';
import { useCallback, useEffect, useState } from 'react';
import { useColumnConfigStore } from '@/entities/column-config';
import { useReferenceTypeStore } from '../model/store';
import { loadDictionary } from './dictionary-storage';
import { normalizeKey } from './normalize-key';

export interface ColumnDictionary {
  /** Код → наименование из справочника; без словаря возвращает код как есть. */
  resolve: (code: string) => string;
  /** true — у колонки есть тип и словарь загружен (можно показывать имена). */
  hasDictionary: boolean;
}

const IDENTITY: ColumnDictionary = {
  resolve: (code) => code,
  hasDictionary: false,
};

/**
 * Словарь подстановки для колонки датасета.
 *
 * Если колонке назначен пользовательский тип (ColumnConfig.customTypeId),
 * лениво загружает словарь «код → имя» и возвращает resolve для рендера.
 * Контракт: подстановка влияет ТОЛЬКО на отображение — в фильтры,
 * drill-down и ключи React уходят исходные коды.
 */
export function useColumnDictionary(
  datasetId: string | null | undefined,
  columnName: string | null | undefined
): ColumnDictionary {
  const customTypeId = useColumnConfigStore((s) => {
    if (!datasetId || !columnName) return undefined;
    return s.configsByDataset[datasetId]?.find(
      (c) => c.columnName === columnName
    )?.customTypeId;
  });

  const refType = useReferenceTypeStore((s) =>
    customTypeId ? s.types.find((t) => t.id === customTypeId) : undefined
  );

  const [dict, setDict] = useState<Map<string, string> | null>(null);

  const typeId = refType?.id;
  const typeUpdatedAt = refType?.updatedAt;

  useEffect(() => {
    if (!typeId) {
      setDict(null);
      return;
    }
    let cancelled = false;
    loadDictionary(typeId).then((d) => {
      if (!cancelled) setDict(d);
    });
    return () => {
      cancelled = true;
    };
    // typeUpdatedAt в deps: после замены справочника словарь перечитывается
  }, [typeId, typeUpdatedAt]);

  const normalization = refType?.keyNormalization ?? 'none';

  const resolve = useCallback(
    (code: string): string => {
      if (!dict) return code;
      return dict.get(normalizeKey(code, normalization)) ?? code;
    },
    [dict, normalization]
  );

  if (!refType) return IDENTITY;
  return { resolve, hasDictionary: dict !== null };
}
