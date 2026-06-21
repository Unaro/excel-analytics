'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createMigration } from '@/shared/lib/storage/migration';
import { nanoid } from 'nanoid';
import type { ReferenceType } from './types';

interface ReferenceTypeState {
  types: ReferenceType[];

  addType: (type: Omit<ReferenceType, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateType: (
    id: string,
    updates: Partial<Omit<ReferenceType, 'id' | 'createdAt'>>
  ) => void;
  removeType: (id: string) => void;

  getType: (id: string) => ReferenceType | undefined;
  /** Типы, привязанные к данному датасету-справочнику. */
  getTypesByDictionary: (dictionaryDatasetId: string) => ReferenceType[];
}

/**
 * Стор пользовательских типов (справочники).
 *
 * Хранит только метаданные типа; сам словарь «код → имя» лежит
 * в IndexedDB под ключом `refdict:<typeId>` (см. lib/dictionary-storage)
 * и в persist не попадает.
 */
export const useReferenceTypeStore = create<ReferenceTypeState>()(
  persist(
    (set, get) => ({
      types: [],

      addType: (type) => {
        const id = nanoid();
        const now = Date.now();
        set((state) => ({
          types: [...state.types, { ...type, id, createdAt: now, updatedAt: now }],
        }));
        return id;
      },

      updateType: (id, updates) => {
        set((state) => ({
          types: state.types.map((t) =>
            t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t
          ),
        }));
      },

      removeType: (id) => {
        set((state) => ({ types: state.types.filter((t) => t.id !== id) }));
      },

      getType: (id) => get().types.find((t) => t.id === id),

      getTypesByDictionary: (dictionaryDatasetId) =>
        get().types.filter((t) => t.dictionaryDatasetId === dictionaryDatasetId),
    }),
    {
      name: 'reference-type-storage',
      version: 1,
      migrate: createMigration({ 1: (state) => state }),
    }
  )
);
