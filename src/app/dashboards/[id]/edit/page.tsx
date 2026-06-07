import { Suspense } from 'react';
import { EditDashboardWidget } from '@/features/edit-dashboard';
import { LoadingScreen } from '@/shared/ui/loading-screen';
import type { DynamicPageProps } from '@/shared/lib/types/next';

export const dynamic = 'force-dynamic';

export default function EditDashboardPage({ params }: DynamicPageProps<['id']>) {
  return (
    <Suspense fallback={<LoadingScreen message="Загрузка редактора..." />}>
      <EditDashboardPageContent params={params} />
    </Suspense>
  );
}

async function EditDashboardPageContent({ params }: DynamicPageProps<['id']>) {
  const { id } = await params;
  return <EditDashboardWidget dashboardId={id} />;
}