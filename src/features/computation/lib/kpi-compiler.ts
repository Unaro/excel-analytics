/**
 * Компилирует KPI-виджеты в формат, понятный engine.compute()
 * 
 * Архитектура:
 * - Каждый aggregate KPI → GroupMetric с fieldBinding на колонку
 * - Каждый calculated KPI → GroupMetric с metricBindings на другие KPI
 * - Все метрики живут в одной "виртуальной" IndicatorGroup
 * - Dashboard virtualMetrics = 1:1 с метриками группы (для маппинга результата)
 */

import { KPIWidget } from "@/entities/dashboard";
import { FieldBinding, GroupMetric, IndicatorGroup, IndicatorGroupInDashboard, MetricBinding, MetricTemplate, VirtualMetric, VirtualMetricBindingInDashboard } from "@/shared/lib/validators";

export const KPI_VIRTUAL_GROUP_ID = '__kpi_virtual_group__';

export interface CompiledKPI {
  groups: IndicatorGroup[];
  dashboardGroupsConfig: IndicatorGroupInDashboard[];
  virtualMetrics: VirtualMetric[];
  widgetToVmMap: Map<string, string>; // widgetId → virtualMetricId
}

export function compileKPIsToComputeParams(
  widgets: KPIWidget[],
  templates: MetricTemplate[]
): CompiledKPI {
  const metrics: GroupMetric[] = [];
  const virtualMetrics: VirtualMetric[] = [];
  const bindings: VirtualMetricBindingInDashboard[] = [];
  const widgetToVmMap = new Map<string, string>();

  // === Первый проход: aggregate KPI (привязка к колонке) ===
  for (const widget of widgets) {
    const template = templates.find(t => t.id === widget.templateId);
    if (!template || template.type !== 'aggregate') continue;

    const metricId = `kpi_m_${widget.id}`;
    const vmId = `kpi_vm_${widget.id}`;
    widgetToVmMap.set(widget.id, vmId);

    const fieldAlias = template.aggregateField || 'value';
    const columnName = widget.bindings[fieldAlias];

    const fieldBindings: FieldBinding[] = columnName ? [{
      id: `fb_${widget.id}`,
      fieldAlias,
      columnName,
    }] : [];

    metrics.push({
      id: metricId,
      templateId: template.id,
      fieldBindings,
      metricBindings: [],
      enabled: true,
      order: metrics.length,
    });

    virtualMetrics.push({
      id: vmId,
      name: widget.customName || template.name,
      displayFormat: template.displayFormat,
      decimalPlaces: template.decimalPlaces,
      order: virtualMetrics.length,
      unit: template.suffix || template.prefix,
    });

    bindings.push({
      virtualMetricId: vmId,
      metricId: metricId,
    });
  }

  // === Второй проход: calculated KPI (формулы между KPI) ===
  for (const widget of widgets) {
    const template = templates.find(t => t.id === widget.templateId);
    if (!template || template.type !== 'calculated' || !template.formula) continue;

    const metricId = `kpi_m_${widget.id}`;
    const vmId = `kpi_vm_${widget.id}`;
    widgetToVmMap.set(widget.id, vmId);

    // widget.bindings[varName] = targetWidgetId
    const metricBindings: MetricBinding[] = [];
    for (const [varName, targetWidgetId] of Object.entries(widget.bindings)) {
      if (!widgets.some(w => w.id === targetWidgetId)) continue;
      metricBindings.push({
        id: `mb_${widget.id}_${varName}`,
        metricAlias: varName,
        metricId: `kpi_m_${targetWidgetId}`,
      });
    }

    metrics.push({
      id: metricId,
      templateId: template.id,
      fieldBindings: [],
      metricBindings,
      enabled: true,
      order: metrics.length,
    });

    virtualMetrics.push({
      id: vmId,
      name: widget.customName || template.name,
      displayFormat: template.displayFormat,
      decimalPlaces: template.decimalPlaces,
      order: virtualMetrics.length,
      unit: template.suffix || template.prefix,
    });

    bindings.push({
      virtualMetricId: vmId,
      metricId: metricId,
    });
  }

  const virtualGroup: IndicatorGroup = {
    id: KPI_VIRTUAL_GROUP_ID,
    name: 'KPI',
    fieldMappings: [],
    metrics,
    order: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const dashboardGroupsConfig: IndicatorGroupInDashboard[] = [{
    groupId: KPI_VIRTUAL_GROUP_ID,
    enabled: true,
    order: 0,
    virtualMetricBindings: bindings,
  }];

  return {
    groups: [virtualGroup],
    dashboardGroupsConfig,
    virtualMetrics,
    widgetToVmMap,
  };
}