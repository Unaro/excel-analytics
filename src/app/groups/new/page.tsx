import { Suspense } from 'react';
import { CreateGroupWidget } from '@/features/group-builder';
import { LoadingScreen } from '@/shared/ui/loading-screen';

export const dynamic = 'force-dynamic';

export default function NewGroupPage() {
  return (
    <Suspense fallback={<LoadingScreen message="Загрузка конструктора группы..." />}>
      <CreateGroupWidget />
    </Suspense>
  );
}