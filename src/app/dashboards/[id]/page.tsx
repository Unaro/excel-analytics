import { Suspense } from 'react';
import { DashboardViewWidget } from '@/widgets/dashboard-view';
import { LoadingScreen } from '@/shared/ui/loading-screen';

export default function DashboardPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingScreen message="Загрузка дашборда..." />}>
      <DashboardViewWidget params={params} />
    </Suspense>
  );
}