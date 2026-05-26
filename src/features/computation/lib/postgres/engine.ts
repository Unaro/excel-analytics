import type { ClientComputeParams, IComputeEngine } from '../types';
import { computePgMetrics } from '@/app/actions/pg-compute';
import { compileQuery } from '../query-compiler';
import { getActiveFilter, formatValue } from '../utils';
import { postProcessAggregates } from '../post-process';
import { decryptConfig } from '@/shared/lib/utils/crypto';
import type { PgConnectionConfig } from '@/shared/api/postgres/client';
import { useDatasetStore } from '@/entities/dataset';
import { DashboardComputationResult, GroupComputationResult, VirtualMetricValue } from '@/entities/metric';

/**
 * Экранирует идентификатор SQL (schema/table/column) двойными кавычками
 */
function quoteIdent(id: string): string {
  return `"${id.replace(/"/g, '""')}"`;
}

export class PgEngine implements IComputeEngine {
  async initialize(): Promise<void> {}

  async compute(params: ClientComputeParams): Promise<DashboardComputationResult> {
    const { dashboardId, encryptedConfig, dashboardGroupsConfig, virtualMetrics, filters, datasetId } = params;

    if (!encryptedConfig) throw new Error('Missing encryptedConfig for PostgreSQL');

    const dataset = useDatasetStore.getState().datasets[datasetId];
    if (!dataset?.pgConfig?.schema || !dataset.pgConfig.table) {
      throw new Error(`PostgreSQL dataset ${datasetId} missing schema/table config`);
    }
    const realTableName = `${quoteIdent(dataset.pgConfig.schema)}.${quoteIdent(dataset.pgConfig.table)}`;

    const start = Date.now();

    const decryptedConfig = await decryptConfig<PgConnectionConfig>(encryptedConfig);
    const pgParams = { ...params, tableName: realTableName };
    const response = await computePgMetrics(pgParams, decryptedConfig);

    const rows = response.rows as Record<string, unknown>[];
    const { formulas } = compileQuery(pgParams, 'postgres');
    const processed = postProcessAggregates(rows, formulas);

    const groups: GroupComputationResult[] = dashboardGroupsConfig
      .filter(cfg => cfg.enabled)
      .map(cfg => {
        const groupDef = params.groups.find(g => g.id === cfg.groupId);
        const groupVirtualMetrics: VirtualMetricValue[] = virtualMetrics.map(vm => {
          const binding = cfg.virtualMetricBindings?.find(b => b.virtualMetricId === vm.id);
          if (!binding) return { virtualMetricId: vm.id, virtualMetricName: vm.name, value: null, formattedValue: '—', sourceMetricId: '' };
          const alias = `${cfg.groupId}__${binding.metricId}`;
          const numericValue = typeof processed[alias] === 'number' ? processed[alias] : null;
          return {
            virtualMetricId: vm.id,
            virtualMetricName: vm.name,
            value: numericValue,
            formattedValue: formatValue(numericValue, vm.displayFormat, vm.decimalPlaces, vm.unit),
            sourceMetricId: binding.metricId
          };
        });
        return {
          groupId: cfg.groupId,
          groupName: groupDef?.name ?? `Группа ${cfg.groupId}`,  // ← Фоллбэк
          virtualMetrics: groupVirtualMetrics,
          recordCount: rows.length > 0 ? (rows[0]['_record_count'] as number) ?? rows.length : 0,
          computedAt: Date.now()
        };
      });

    return {
      dashboardId,
      hierarchyFilters: filters,
      activeFilter: getActiveFilter(filters),
      virtualMetrics,
      groups,
      totalRecords: rows.length,
      computedAt: Date.now(),
      computationTime: Date.now() - start,
    };
  }

  dispose(): void {}
}