import { Suspense } from 'react';
import { DashboardListWidget } from '@/widgets/dashboard-list';
import { LoadingScreen } from '@/shared/ui/loading-screen';

export default function DashboardsPage() {
  return (
    <Suspense fallback={<LoadingScreen message="Загрузка списка дашбордов..." />}>
      <DashboardListWidget />
    </Suspense>
  );
}