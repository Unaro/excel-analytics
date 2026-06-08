import { Suspense } from 'react';
import { CreateDashboardWidget } from '@/features/create-dashboard';
import { LoadingScreen } from '@/shared/ui/loading-screen';
import type { StaticPageProps } from '@/shared/lib/types/next';

export const dynamic = 'force-dynamic';

export default function NewDashboardPage(_props: StaticPageProps) {
  return (
    <Suspense fallback={<LoadingScreen message="Загрузка конструктора..." />}>
      <CreateDashboardWidget />
    </Suspense>
  );
}