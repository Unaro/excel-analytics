'use client';

import { LoadingScreen } from '@/shared/ui/loading-screen';
import { EngineGate } from '@/shared/ui/engine-gate';
import { GroupViewContent } from './GroupViewContent';
import { useEngineStatus } from '@/entities/dataset';
import { ClientOnly } from '@/shared/ui/client-only';

interface GroupViewWidgetProps {
  groupId: string;
}

export function GroupViewWidget({ groupId }: GroupViewWidgetProps) {
  const { status, reload, isReloading } = useEngineStatus();

  return (
    <ClientOnly fallback={<LoadingScreen message="Загрузка профиля группы..." />}>
      <EngineGate
        fallbackHref="/setup"
        status={status}
        reload={reload}
        isReloading={isReloading}
      >
        <GroupViewContent groupId={groupId} />
      </EngineGate>
    </ClientOnly>
  );
}