import { Suspense } from 'react';
import { SettingsWidget } from '@/widgets/settings';
import { LoadingScreen } from '@/shared/ui/loading-screen';

export default function SettingsPage() {
  return (
    <Suspense fallback={<LoadingScreen message="Загрузка настроек..." />}>
      <SettingsWidget />
    </Suspense>
  );
}