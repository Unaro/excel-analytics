import { Suspense } from 'react';
import { EditGroupWidget } from '@/features/edit-group';
import { LoadingScreen } from '@/shared/ui/loading-screen';

export default function EditGroupPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingScreen message="Загрузка редактора группы..." />}>
      <EditGroupPageAsync params={params} />
    </Suspense>
  );
}

async function EditGroupPageAsync({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditGroupWidget groupId={id} />;
}