import { Suspense } from 'react';
import { DashboardViewWidget } from '@/widgets/dashboard-view';
import { LoadingScreen } from '@/shared/ui/loading-screen';
import type { DynamicPageProps } from '@/shared/lib/types/next';

export const dynamic = 'force-dynamic';

export default function DashboardPage({ params }: DynamicPageProps<['id']>) {
  return (
    <Suspense fallback={<LoadingScreen message="Загрузка дашборда..." />}>
      <DashboardViewWidget params={params} />
    </Suspense>
  );
}