import { Suspense } from 'react';
import { ReferenceManager } from '@/features/manage-references';
import { LoadingScreen } from '@/shared/ui/loading-screen';

export default function ReferencesPage() {
  return (
    <Suspense fallback={<LoadingScreen message="Загрузка справочников..." />}>
      <ReferenceManager />
    </Suspense>
  );
}
