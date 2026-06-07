'use client';

import { ClientOnly } from '@/shared/lib/hydration';
import { LoadingScreen } from '@/shared/ui/loading-screen';
import { DashboardViewContent } from './DashboardViewContent';
import { EngineGate } from '@/shared/ui/engine-gate';

interface DashboardViewWidgetProps {
  params: Promise<{ id: string }>;
}

/**
 * Публичная точка входа виджета просмотра дашборда.
 *
 * Тонкая обёртка:
 *  - Оборачивает контент в `ClientOnly` для предотвращения hydration mismatch
 *    (сервер и клиент оба рендерят `<LoadingScreen />` при первом рендере).
 *  - Не содержит бизнес-логики, состояния или импортов features/entities.
 *
 * Вся реальная работа — в приватном `DashboardViewContent`.
 */
export function DashboardViewWidget({ params }: DashboardViewWidgetProps) {
  return (
    <ClientOnly fallback={<LoadingScreen message="Загрузка дашборда..." />}>
      <EngineGate fallbackHref="/setup">
        <DashboardViewContent params={params} />
      </EngineGate>
    </ClientOnly>
  );
}