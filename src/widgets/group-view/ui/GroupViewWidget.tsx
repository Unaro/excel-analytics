'use client';

import { ClientOnly } from '@/shared/lib/hydration';
import { LoadingScreen } from '@/shared/ui/loading-screen';
import { GroupViewContent } from './GroupViewContent'

interface GroupViewWidgetProps {
  groupId: string;
}

export function GroupViewWidget({ groupId }: GroupViewWidgetProps) {
  return (
    <ClientOnly fallback={<LoadingScreen message="Загрузка профиля группы..." />}>
      <GroupViewContent groupId={groupId} />
    </ClientOnly>
  );
}