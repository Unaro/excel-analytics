'use client';

import { LoadingScreen } from '@/shared/ui/loading-screen';
import { SetupWizardContent } from './SetupWizardContent';
import { ClientOnly } from '@/shared/ui/client-only';

/**
 * Публичная точка входа мастера настройки.
 *
 * Тонкая обёртка:
 *  - Оборачивает контент в `ClientOnly` для предотвращения hydration mismatch
 *  - Не содержит бизнес-логики, состояния или импортов features/entities
 *
 * Вся реальная работа — в приватном `SetupWizardContent`.
 */
export function SetupWizardWidget() {
  return (
    <ClientOnly fallback={<LoadingScreen message="Загрузка страницы настройки..." />}>
      <SetupWizardContent />
    </ClientOnly>
  );
}