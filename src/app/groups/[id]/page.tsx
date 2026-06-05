import { Suspense } from 'react';
import { GroupViewWidget } from '@/widgets/group-view';
import { LoadingScreen } from '@/shared/ui/loading-screen';

export default function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingScreen message="Загрузка профиля группы..." />}>
      <GroupPageAsync params={params} />
    </Suspense>
  );
}

async function GroupPageAsync({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GroupViewWidget groupId={id} />;
}