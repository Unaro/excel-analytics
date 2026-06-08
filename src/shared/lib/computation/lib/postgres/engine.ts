import type {
  ClientComputeParams,
  IComputeEngine,
  MetricAggregationMeta,
} from '../types';
import { compileQuery } from '../query-compiler';
import { getActiveFilter, formatValue } from '../utils';
import { postProcessAggregates } from '../post-process';
import { decryptConfig } from '@/shared/lib/utils/crypto';
import type { PgConnectionConfig } from '@/shared/api/postgres/client';
import type {
  DashboardComputationResult,
  GroupComputationResult,
  VirtualMetricValue,
} from '@/shared/lib/types/computation';
import { computePgMetrics } from '@/shared/api/server-actions';
import { aggregateProcessedRows } from '../aggregation';

/**
 * Безопасное экранирование SQL-идентификаторов.
 */
function quoteIdent(id: string): string {
  return `"${id.replace(/"/g, '""')}"`;
}

function buildAggregateMetadataMap(
  params: ClientComputeParams
): Map<string, MetricAggregationMeta> {
  const metadata = new Map<string, MetricAggregationMeta>();
  for (const cfg of params.dashboardGroupsConfig) {
    if (!cfg.enabled) continue;
    const groupDef = params.groups.find(g => g.id === cfg.groupId);
    if (!groupDef) continue;
    for (const metric of groupDef.metrics) {
      if (!metric.enabled) continue;
      const tpl = params.metricTemplates.find(t => t.id === metric.templateId);
      if (tpl?.type === 'aggregate' && tpl.aggregateFunction) {
        const alias = `${cfg.groupId}__${metric.id}`;
        metadata.set(alias, { aggregateFunction: tpl.aggregateFunction });
      }
    }
  }
  return metadata;
}

export class PgEngine implements IComputeEngine {
  async initialize(): Promise<void> {
    // PG не требует инициализации
  }

  async compute(params: ClientComputeParams): Promise<DashboardComputationResult> {
    const {
      dashboardId,
      encryptedConfig,
      dashboardGroupsConfig,
      virtualMetrics,
      filters,
      datasetId,
      groupByColumn,
      pgSchema,
      pgTable,
    } = params;

    if (!encryptedConfig) {
      throw new Error('Missing encryptedConfig for PostgreSQL');
    }

    // ✅ Читаем schema/table ИЗ params, а НЕ из useDatasetStore
    if (!pgSchema || !pgTable) {
      throw new Error(
        `PostgreSQL dataset ${datasetId} missing pgSchema/pgTable in params. ` +
        `Caller must pass these from entities/dataset store.`
      );
    }

    const realTableName = `${quoteIdent(pgSchema)}.${quoteIdent(pgTable)}`;
    const start = Date.now();

    const decryptedConfig = await decryptConfig<PgConnectionConfig>(encryptedConfig);
    const pgParams: ClientComputeParams = {
      ...params,
      tableName: realTableName,
    };

    const response = await computePgMetrics(pgParams, decryptedConfig);
    if (!response.success) {
      throw new Error('PG query failed: no data returned');
    }

    const rows = response.rows as Record<string, unknown>[];
    const { formulas, aggregateMetadata } = compileQuery(pgParams, 'postgres');
    const processedRows = postProcessAggregates(rows, formulas);

    const computeTotalRecordCount = (sqlRows: Record<string, unknown>[]): number => {
      let total = 0;
      for (const row of sqlRows) {
        const rc = row['_record_count'];
        if (typeof rc === 'number' && isFinite(rc)) {
          total += rc;
        } else if (typeof rc === 'bigint') {
          total += Number(rc);
        }
      }
      return total;
    };
    const totalRecords = computeTotalRecordCount(rows);

    const groups: GroupComputationResult[] = dashboardGroupsConfig
      .filter(cfg => cfg.enabled)
      .map(cfg => {
        const groupDef = params.groups.find(g => g.id === cfg.groupId);

        const buildVirtualMetrics = (
          processed: Record<string, number | null>
        ): VirtualMetricValue[] => {
          return virtualMetrics.map(vm => {
            const binding = cfg.virtualMetricBindings?.find(
              b => b.virtualMetricId === vm.id
            );
            if (!binding) {
              return {
                virtualMetricId: vm.id,
                virtualMetricName: vm.name,
                value: null,
                formattedValue: '—',
                sourceMetricId: '',
              };
            }
            const alias = `${cfg.groupId}__${binding.metricId}`;
            const numericValue =
              typeof processed[alias] === 'number' ? processed[alias] : null;
            return {
              virtualMetricId: vm.id,
              virtualMetricName: vm.name,
              value: numericValue,
              formattedValue: formatValue(
                numericValue,
                vm.displayFormat,
                vm.decimalPlaces,
                vm.unit
              ),
              sourceMetricId: binding.metricId,
            };
          });
        };

        const breakdown = groupByColumn
          ? processedRows
              .map((processed, idx) => {
                const rawLabel = rows[idx]['_group_label'];
                const label =
                  rawLabel === null || rawLabel === undefined
                    ? ''
                    : String(rawLabel).trim();
                const rowRc = rows[idx]['_record_count'];
                const recordCount =
                  typeof rowRc === 'number'
                    ? rowRc
                    : typeof rowRc === 'bigint'
                    ? Number(rowRc)
                    : 0;
                return {
                  label,
                  recordCount,
                  virtualMetrics: buildVirtualMetrics(processed),
                };
              })
              .filter(item => item.label !== '')
          : undefined;

        const summaryProcessed = groupByColumn
          ? aggregateProcessedRows(processedRows, aggregateMetadata, formulas)
          : processedRows[0] || {};

        return {
          groupId: cfg.groupId,
          groupName: groupDef?.name ?? `Группа ${cfg.groupId}`,
          virtualMetrics: buildVirtualMetrics(summaryProcessed),
          breakdown,
          recordCount: totalRecords,
          computedAt: Date.now(),
        };
      });

    return {
      dashboardId,
      hierarchyFilters: filters,
      activeFilter: getActiveFilter(filters),
      virtualMetrics,
      groups,
      totalRecords,
      computedAt: Date.now(),
      computationTime: Date.now() - start,
    };
  }

  dispose(): void {
    // Соединения закрываются автоматически в Server Action
  }
}