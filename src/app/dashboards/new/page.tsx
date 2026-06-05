import { Suspense } from 'react';
import { CreateDashboardWidget } from '@/features/create-dashboard';
import { LoadingScreen } from '@/shared/ui/loading-screen';

export const dynamic = 'force-dynamic';

export default function NewDashboardPage() {
  return (
    <Suspense fallback={<LoadingScreen message="Загрузка конструктора..." />}>
      <CreateDashboardWidget />
    </Suspense>
  );
}