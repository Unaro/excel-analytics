'use client';
import { useRouter } from 'next/navigation';
import { DashboardBuilderUI } from './DashboardBuilderUI';
import { useDashboardBuilder } from '../model/use-dashboard-builder';
import { toast } from '@/shared/ui/toast';

export function CreateDashboardWidget() {
  const router = useRouter();
  const builder = useDashboardBuilder();

  const handleSave = () => {
    try {
      const id = builder.saveDashboard();
      toast.success('Дашборд создан');
      router.push(`/dashboards/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка сохранения');
    }
  };

  return <DashboardBuilderUI builder={builder} mode="create" onSave={handleSave} />;
}