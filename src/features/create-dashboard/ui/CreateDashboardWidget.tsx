'use client';
import { DashboardBuilderUI } from '@/widgets/dashboard-builder/ui/DashboardBuilderUI';
import { useDashboardBuilder } from '@/features/dashboard-builder/model/use-dashboard-builder';

export function CreateDashboardWidget() {
  const builder = useDashboardBuilder();
  return <DashboardBuilderUI builder={builder} mode="create" />;
}