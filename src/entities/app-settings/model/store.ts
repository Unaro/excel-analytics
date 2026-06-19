'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createMigration } from '@/shared/lib/storage/migration';
import type { AggregateFn } from '@/shared/lib/computation/lib/aggregate-functions';
import type { AggregateFormulaOptions } from '@/shared/lib/computation/lib/types';

interface AppSettingsState {
  /** Чем оборачивается голая колонка вне агрегата в формуле. */
  defaultAggregate: AggregateFn;
  /** true — голая колонка вне агрегата запрещена (нужен явный агрегат). */
  requireExplicitAggregate: boolean;

  setDefaultAggregate: (fn: AggregateFn) => void;
  setRequireExplicitAggregate: (value: boolean) => void;
}

/**
 * Глобальные настройки приложения.
 *
 * Пока — только поведение агрегатных формул (дефолтный авто-агрегат и
 * строгий режим). Влияет на компиляцию формул в query-compiler.
 */
export const useAppSettingsStore = create<AppSettingsState>()(
  persist(
    (set) => ({
      defaultAggregate: 'SUM',
      requireExplicitAggregate: false,
      setDefaultAggregate: (defaultAggregate) => set({ defaultAggregate }),
      setRequireExplicitAggregate: (requireExplicitAggregate) =>
        set({ requireExplicitAggregate }),
    }),
    {
      name: 'app-settings-storage',
      version: 1,
      migrate: createMigration({ 1: (state) => state }),
    }
  )
);

/** Собирает формульные настройки для ClientComputeParams. */
export function selectFormulaOptions(s: AppSettingsState): AggregateFormulaOptions {
  return {
    defaultAggregate: s.defaultAggregate,
    requireExplicit: s.requireExplicitAggregate,
  };
}
