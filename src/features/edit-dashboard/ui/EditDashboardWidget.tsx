'use client';
import { useRouter } from 'next/navigation';
import { DashboardBuilderUI } from '@/widgets/dashboard-builder';
import { useDashboardBuilder } from '@/features/dashboard-builder/model/use-dashboard-builder';
import { toast } from 'sonner';

interface EditDashboardWidgetProps {
  dashboardId: string;
}

export function EditDashboardWidget({ dashboardId }: EditDashboardWidgetProps) {
  const router = useRouter();
  const builder = useDashboardBuilder(dashboardId);

  const handleSave = () => {
    try {
      const id = builder.saveDashboard();
      toast.success('Дашборд сохранён');
      router.push(`/dashboards/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка сохранения');
    }
  };

  return <DashboardBuilderUI builder={builder} mode="edit" onSave={handleSave} />;
}