'use client';
// Запоминаемые предпочтения ВИДА группы (per-group, не часть конфига группы):
// выбранные метрики и вторая ось 2-D. Живут в localStorage (синхронно, без
// гонок гидрации) — это лёгкие UI-настройки, а не данные/конфиг.
//
// Уровень/путь иерархии СЮДА НЕ кладём: он в URL (?path=), refresh/ссылка уже
// работают, а авто-восстановление глубокого уровня при возврате дезориентирует.
// Сортировка тоже не персистится (дериватив от активной метрики).
//
// Метрики храним по sourceMetricId (стабильный id метрики группы), а не по
// производному vm-id: тот меняется при ренейме/смене формата метрики, и выбор
// бы «слетал». Резолв sourceMetricId → текущий vm-id — на чтении.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createMigration } from '@/shared/lib/storage/migration';
import type { SecondaryDimension } from '@/shared/lib/computation/lib/types';

export interface GroupViewPrefs {
  /** sourceMetricId выбранных метрик (пусто/нет → дефолт «первая»). */
  selectedSourceMetricIds?: string[];
  /** Вторая ось 2-D (дата|колонка|бакеты) или null — обычный 1-D. */
  secondary?: SecondaryDimension | null;
}

interface GroupViewPrefsState {
  prefsByGroup: Record<string, GroupViewPrefs>;
  setPrefs: (groupId: string, patch: Partial<GroupViewPrefs>) => void;
}

export const useGroupViewPrefsStore = create<GroupViewPrefsState>()(
  persist(
    (set) => ({
      prefsByGroup: {},
      setPrefs: (groupId, patch) =>
        set((s) => ({
          prefsByGroup: {
            ...s.prefsByGroup,
            [groupId]: { ...s.prefsByGroup[groupId], ...patch },
          },
        })),
    }),
    {
      name: 'group-view-prefs-storage',
      version: 1,
      migrate: createMigration({ 1: (state) => state }),
    }
  )
);
