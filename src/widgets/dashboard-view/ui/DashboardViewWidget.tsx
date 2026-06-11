'use client';

import { LoadingScreen } from '@/shared/ui/loading-screen';
import { DashboardViewContent } from './DashboardViewContent';
import { EngineGate } from '@/shared/ui/engine-gate';
import { useEngineStatus } from '@/entities/dataset';
import { ClientOnly } from '@/shared/ui/client-only';

interface DashboardViewWidgetProps {
  params: Promise<{ id: string }>;
}

/**
 * Публичная точка входа виджета просмотра дашборда.
 *
 * Оборачивает контент в:
 *   1. ClientOnly — предотвращает hydration mismatch
 *   2. EngineGate — защищает от нерабочего движка
 *
 * useEngineStatus вызывается здесь (на widget-уровне),
 * а результат передаётся в презентационный EngineGate через пропсы.
 */
export function DashboardViewWidget({ params }: DashboardViewWidgetProps) {
  const { status, reload, isReloading } = useEngineStatus();

  return (
    <ClientOnly fallback={<LoadingScreen message="Загрузка дашборда..." />}>
      <EngineGate
        fallbackHref="/setup"
        status={status}
        reload={reload}
        isReloading={isReloading}
      >
        <DashboardViewContent params={params} />
      </EngineGate>
    </ClientOnly>
  );
}