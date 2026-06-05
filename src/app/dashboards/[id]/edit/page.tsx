import { Suspense } from 'react';
import { EditDashboardWidget } from '@/features/edit-dashboard';
import { LoadingScreen } from '@/shared/ui/loading-screen';

export const dynamic = 'force-dynamic';

export default function EditDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingScreen message="Загрузка редактора..." />}>
      <EditDashboardWidgetAsync params={params} />
    </Suspense>
  );
}

async function EditDashboardWidgetAsync({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditDashboardWidget dashboardId={id} />;
}