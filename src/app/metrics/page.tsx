import { Suspense } from 'react';
import { MetricsManagerWidget } from '@/widgets/metrics-manager';
import { LoadingScreen } from '@/shared/ui/loading-screen';

export default function MetricsPage() {
  return (
    <Suspense fallback={<LoadingScreen message="Загрузка метрик..." />}>
      <MetricsManagerWidget />
    </Suspense>
  );
}