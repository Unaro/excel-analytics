import { Suspense } from 'react';
import { HierarchyBuilderWidget } from '@/widgets/hierarchy-builder';
import { LoadingScreen } from '@/shared/ui/loading-screen';

export default function HierarchyPage() {
  return (
    <Suspense fallback={<LoadingScreen message="Загрузка настройки иерархии..." />}>
      <HierarchyBuilderWidget />
    </Suspense>
  );
}