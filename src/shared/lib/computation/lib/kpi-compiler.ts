// shared/lib/computation/lib/kpi-compiler.ts
import type {
  FieldBinding,
  GroupMetric,
  IndicatorGroup,
  IndicatorGroupInDashboard,
  MetricBinding,
  MetricTemplate,
  VirtualMetric,
  VirtualMetricBindingInDashboard,
} from '@/shared/lib/validators';
import { KPIWidget } from '@/shared/lib/types/dashboard';
import { extractVariables } from '@/shared/lib/utils/formula';

export const KPI_VIRTUAL_GROUP_ID = 'kpi_virtual_group';

export interface CompiledKPI {
  groups: IndicatorGroup[];
  dashboardGroupsConfig: IndicatorGroupInDashboard[];
  virtualMetrics: VirtualMetric[];
  widgetToVmMap: Map<string, string>;
}

/**
 * Компилирует KPI-виджеты дашборда в параметры вычисления: синтетическая
 * группа KPI_VIRTUAL_GROUP_ID с метрикой на каждый виджет + виртуальные
 * метрики и их привязки. widgetToVmMap связывает виджет с VM для отрисовки.
 */
export function compileKPIsToComputeParams(
  widgets: KPIWidget[],
  templates: MetricTemplate[]
): CompiledKPI {
  const metrics: GroupMetric[] = [];
  const virtualMetrics: VirtualMetric[] = [];
  const bindings: VirtualMetricBindingInDashboard[] = [];
  const widgetToVmMap = new Map<string, string>();

  // Всё — формулы. Для каждой переменной формулы решаем по значению
  // привязки: указывает на другой KPI-виджет → метрика-зависимость;
  // иначе → колонка датасета (бывшая «агрегатная» привязка).
  const widgetIds = new Set(widgets.map((w) => w.id));

  for (const widget of widgets) {
    const template = templates.find((t) => t.id === widget.templateId);
    if (!template?.formula) continue;

    const metricId = `kpi_m_${widget.id}`;
    const vmId = `kpi_vm_${widget.id}`;
    widgetToVmMap.set(widget.id, vmId);

    const fieldBindings: FieldBinding[] = [];
    const metricBindings: MetricBinding[] = [];
    for (const varName of extractVariables(template.formula)) {
      const bound = widget.bindings[varName];
      if (!bound) continue;
      if (widgetIds.has(bound)) {
        metricBindings.push({
          id: `mb_${widget.id}_${varName}`,
          metricAlias: varName,
          metricId: `kpi_m_${bound}`,
        });
      } else {
        fieldBindings.push({
          id: `fb_${widget.id}_${varName}`,
          fieldAlias: varName,
          columnName: bound,
        });
      }
    }

    metrics.push({
      id: metricId,
      templateId: template.id,
      fieldBindings,
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
      unit: template.unit,
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

  const dashboardGroupsConfig: IndicatorGroupInDashboard[] = [
    {
      groupId: KPI_VIRTUAL_GROUP_ID,
      enabled: true,
      order: 0,
      virtualMetricBindings: bindings,
    },
  ];

  return {
    groups: [virtualGroup],
    dashboardGroupsConfig,
    virtualMetrics,
    widgetToVmMap,
  };
}