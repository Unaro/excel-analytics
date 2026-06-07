'use client';

import { ClientOnly } from '@/shared/lib/hydration';
import { LoadingScreen } from '@/shared/ui/loading-screen';
import { EngineGate } from '@/shared/ui/engine-gate';
import { GroupViewContent } from './GroupViewContent';

interface GroupViewWidgetProps {
  groupId: string;
}

export function GroupViewWidget({ groupId }: GroupViewWidgetProps) {
  return (
    <ClientOnly fallback={<LoadingScreen message="Загрузка профиля группы..." />}>
      <EngineGate fallbackHref="/setup">
        <GroupViewContent groupId={groupId} />
      </EngineGate>
    </ClientOnly>
  );
}