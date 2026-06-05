'use client';

import { ClientOnly } from '@/shared/lib/hydration';
import { LoadingScreen } from '@/shared/ui/loading-screen';
import { SettingsContent } from './SettingsContent';

/**
 * Публичная точка входа страницы настроек.
 *
 * Тонкая обёртка:
 *  - Оборачивает контент в `ClientOnly` для предотвращения hydration mismatch
 *  - Не содержит бизнес-логики, состояния или импортов features/entities
 *
 * Вся реальная работа — в приватном `SettingsContent`.
 */
export function SettingsWidget() {
  return (
    <ClientOnly fallback={<LoadingScreen message="Загрузка настроек..." />}>
      <SettingsContent />
    </ClientOnly>
  );
}