import { Suspense } from 'react';
import { GroupListWidget } from '@/widgets/group-list';
import { LoadingScreen } from '@/shared/ui/loading-screen';

export default function GroupsPage() {
  return (
    <Suspense fallback={<LoadingScreen message="Загрузка списка групп..." />}>
      <GroupListWidget />
    </Suspense>
  );
}