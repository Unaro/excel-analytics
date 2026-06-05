'use client';
import { DashboardBuilderUI } from '@/widgets/dashboard-builder/ui/DashboardBuilderUI';
import { useDashboardBuilder } from '@/features/dashboard-builder/model/use-dashboard-builder';

interface EditDashboardWidgetProps {
  dashboardId: string;
}

export function EditDashboardWidget({ dashboardId }: EditDashboardWidgetProps) {
  const builder = useDashboardBuilder(dashboardId);
  return <DashboardBuilderUI builder={builder} mode="edit" />;
}