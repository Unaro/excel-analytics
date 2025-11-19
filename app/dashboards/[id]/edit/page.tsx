'use client';

import { use } from 'react';
import { DashboardBuilder } from '@/components/dashboard/config/dashboard-builder';
import { useStoreHydration } from '@/lib/hooks/use-store-hydration'; // Используем наш хук
import { Loader2 } from 'lucide-react';

export default function EditDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  // 1. Распаковываем ID
  const { id } = use(params);

  // 2. Ждем гидратации стора (это решает и Hydration Error, и проблему пустого стора)
  const hydrated = useStoreHydration();

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  return <DashboardBuilder dashboardId={id} />;
}