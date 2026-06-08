import { Suspense } from 'react';
import { SetupWizardWidget } from '@/widgets/setup-wizard';
import { LoadingScreen } from '@/shared/ui/loading-screen';

export default function SetupPage() {
  return (
    <Suspense fallback={<LoadingScreen message="Загрузка страницы настройки..." />}>
      <SetupWizardWidget />
    </Suspense>
  );
}