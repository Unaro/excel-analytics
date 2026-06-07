import { Suspense } from 'react';
import { DashboardListWidget } from '@/widgets/dashboard-list';
import { LoadingScreen } from '@/shared/ui/loading-screen';
import type { StaticPageProps } from '@/shared/lib/types/next';

export const dynamic = 'force-dynamic';

export default function DashboardsPage(_props: StaticPageProps) {
  return (
    <Suspense fallback={<LoadingScreen message="Загрузка списка дашбордов..." />}>
      <DashboardListWidget />
    </Suspense>
  );
}