'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createMigration } from '@/shared/lib/storage/migration';
import type { AggregateFn } from '@/shared/lib/computation/lib/aggregate-functions';
import type { AggregateFormulaOptions } from '@/shared/lib/computation/lib/types';

/** Настройки движка DuckDB-wasm (память). */
export interface EngineConfig {
  /** Потолок памяти DuckDB в МБ; null — без явного лимита (по умолчанию). */
  memoryLimitMB: number | null;
}

interface AppSettingsState {
  /** Чем оборачивается голая колонка вне агрегата в формуле. */
  defaultAggregate: AggregateFn;
  /** true — голая колонка вне агрегата запрещена (нужен явный агрегат). */
  requireExplicitAggregate: boolean;

  /** Потолок памяти DuckDB в МБ; null — без явного лимита. */
  duckdbMemoryLimitMB: number | null;

  setDefaultAggregate: (fn: AggregateFn) => void;
  setRequireExplicitAggregate: (value: boolean) => void;
  setDuckdbMemoryLimitMB: (value: number | null) => void;
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
      duckdbMemoryLimitMB: null,
      setDefaultAggregate: (defaultAggregate) => set({ defaultAggregate }),
      setRequireExplicitAggregate: (requireExplicitAggregate) =>
        set({ requireExplicitAggregate }),
      setDuckdbMemoryLimitMB: (duckdbMemoryLimitMB) => set({ duckdbMemoryLimitMB }),
    }),
    {
      name: 'app-settings-storage',
      version: 3,
      migrate: createMigration({
        1: (state) => state,
        // v2: добавлены настройки движка DuckDB (null = авто/без лимита).
        2: (state) => ({
          ...(state as Partial<AppSettingsState>),
          duckdbMemoryLimitMB: null,
        }),
        // v3: убран duckdbThreads — wasm-сборка EH без потоков, SET threads
        // бросает «compiled without threads». Управляем только памятью.
        3: (state) => {
          const next = { ...state };
          delete next.duckdbThreads;
          return next;
        },
      }),
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

/** Собирает настройки движка DuckDB для проброса в воркер. */
export function selectEngineConfig(s: AppSettingsState): EngineConfig {
  return {
    memoryLimitMB: s.duckdbMemoryLimitMB,
  };
}
