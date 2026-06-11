// entities/groupMetricConfig/model/store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createMigration } from '@/shared/lib/storage/migration';
import type { ColorConfig } from '@/shared/lib/types/dashboard';
import type { GroupMetricConfig } from '@/shared/lib/types/group-metric-config';

// Тип перенесён в shared/lib/types/group-metric-config (нужен сервисам
// экспорта/импорта конфигурации) — ре-экспорт для обратной совместимости.
export type { GroupMetricConfig };

interface GroupMetricConfigState {
  /**
   * Структура: configsByGroup[groupId][metricId] = GroupMetricConfig
   *
   * Почему двумерная карта:
   *  - Метрики имеют стабильные ID (nanoid) в рамках группы
   *  - Группы изолированы — удаление одной не трогает другие
   */
  configsByGroup: Record<string, Record<string, GroupMetricConfig>>;

  /**
   * Полностью заменить конфиг метрики
   */
  setMetricConfig: (groupId: string, metricId: string, config: GroupMetricConfig) => void;

  /**
   * Обновить только colorConfig
   */
  updateColorConfig: (groupId: string, metricId: string, colorConfig: ColorConfig) => void;

  /**
   * Селектор для чтения
   */
  getColorConfig: (groupId: string, metricId: string) => ColorConfig | undefined;

  /**
   * Удалить ВСЕ настройки метрики
   */
  clearMetricConfig: (groupId: string, metricId: string) => void;

  /**
   * Удалить ВСЕ настройки всей группы
   */
  clearGroupConfigs: (groupId: string) => void;

  /**
   * Массовый импорт конфигов
   */
  importConfigs: (configs: Record<string, Record<string, GroupMetricConfig>>) => void;
}

export const useGroupMetricConfigStore = create<GroupMetricConfigState>()(
  persist(
    (set, get) => ({
      configsByGroup: {},

      setMetricConfig: (groupId, metricId, config) =>
        set((state) => ({
          configsByGroup: {
            ...state.configsByGroup,
            [groupId]: {
              ...(state.configsByGroup[groupId] || {}),
              [metricId]: config,
            },
          },
        })),

      updateColorConfig: (groupId, metricId, colorConfig) => {
        const current = get().configsByGroup[groupId]?.[metricId] || {};
        set((state) => ({
          configsByGroup: {
            ...state.configsByGroup,
            [groupId]: {
              ...(state.configsByGroup[groupId] || {}),
              [metricId]: { ...current, colorConfig },
            },
          },
        }));
      },

      getColorConfig: (groupId, metricId) =>
        get().configsByGroup[groupId]?.[metricId]?.colorConfig,

      clearMetricConfig: (groupId, metricId) =>
        set((state) => {
          const groupConfigs = state.configsByGroup[groupId];
          if (!groupConfigs) return state;
          const next = { ...groupConfigs };
          delete next[metricId];
          // Если группа пустая — удаляем её целиком
          if (Object.keys(next).length === 0) {
            const nextAll = { ...state.configsByGroup };
            delete nextAll[groupId];
            return { configsByGroup: nextAll };
          }
          return {
            configsByGroup: { ...state.configsByGroup, [groupId]: next },
          };
        }),

      clearGroupConfigs: (groupId) =>
        set((state) => {
          const next = { ...state.configsByGroup };
          delete next[groupId];
          return { configsByGroup: next };
        }),

      importConfigs: (configs) =>
        set((state) => ({
          configsByGroup: { ...state.configsByGroup, ...configs },
        })),
    }),
    {
      name: 'group-metric-config-storage',
      version: 1,
      // v0 (до версионирования) → v1: конфиги совместимы — переносим как есть.
      migrate: createMigration({ 1: (state) => state }),
    }
  )
);