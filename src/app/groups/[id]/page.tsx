import { Suspense } from 'react';
import { GroupViewWidget } from '@/widgets/group-view';
import { LoadingScreen } from '@/shared/ui/loading-screen';
import type { DynamicPageProps } from '@/shared/lib/types/next';

export const dynamic = 'force-dynamic';

export default function GroupPage({ params }: DynamicPageProps<['id']>) {
  return (
    <Suspense fallback={<LoadingScreen message="Загрузка профиля группы..." />}>
      <GroupPageContent params={params} />
    </Suspense>
  );
}

async function GroupPageContent({ params }: DynamicPageProps<['id']>) {
  const { id } = await params;
  return <GroupViewWidget groupId={id} />;
}