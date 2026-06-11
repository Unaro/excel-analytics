import type {
  ClientComputeParams,
  IComputeEngine,
  MetricAggregationMeta,
} from '../types';
import { compileQuery, BREAKDOWN_LIMIT } from '../query-compiler';
import { getActiveFilter, formatValue, computeTotalRecordCount } from '../utils';
import { postProcessAggregates, recalculateFormulasOnAggregated } from '../post-process';
import { decryptConfig } from '@/shared/lib/utils/crypto';
import type { PgConnectionConfig } from '@/shared/api/postgres/client';
import type {
  DashboardComputationResult,
  GroupComputationResult,
  VirtualMetricValue,
} from '@/shared/lib/types/computation';
import { computePgMetrics } from '@/shared/api/server-actions';
import { aggregateProcessedRows } from '../aggregation';
import { qualifiedTableName } from '../sql-utils';

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

/**
 * PostgreSQL Compute Engine.
 *
 */
export class PgEngine implements IComputeEngine {
  async initialize(): Promise<void> {}

  async compute(
    params: ClientComputeParams,
    signal?: AbortSignal  // ✅
  ): Promise<DashboardComputationResult> {
    const {
      dashboardId, encryptedConfig, dashboardGroupsConfig,
      virtualMetrics, filters, datasetId, groupByColumn,
      pgSchema, pgTable,
    } = params;

    if (!encryptedConfig) throw new Error('Missing encryptedConfig for PostgreSQL');
    if (!pgSchema || !pgTable) {
      throw new Error(
        `PostgreSQL dataset ${datasetId} missing pgSchema/pgTable in params.`
      );
    }

    const start = Date.now();

    const decryptedConfig = await decryptConfig<PgConnectionConfig>(encryptedConfig);

    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    // Сервер игнорирует клиентские tableName/validColumns и строит их сам
    // из information_schema (защита от SQL-инъекции) — см. pg-compute.ts.
    const response = await computePgMetrics(params, decryptedConfig);

    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    if (!response.success) {
      throw new Error('PG query failed: no data returned');
    }

    const allRows = response.rows as Record<string, unknown>[];
    // SQL запрашивает BREAKDOWN_LIMIT + 1 строк: лишняя строка — признак
    // усечения breakdown. Обрезаем ДО пост-обработки, чтобы сводка
    // и breakdown считались по одному набору строк.
    const breakdownTruncated =
      !!groupByColumn && allRows.length > BREAKDOWN_LIMIT;
    const rows = breakdownTruncated ? allRows.slice(0, BREAKDOWN_LIMIT) : allRows;

    // Локальная перекомпиляция только ради метаданных пост-обработки
    // (formulas, aggregateMetadata) — SQL на клиенте не исполняется.
    // validColumns берём из ответа сервера, чтобы метаданные совпадали
    // с фактически исполненным запросом.
    const compiled = compileQuery(
      {
        ...params,
        tableName: qualifiedTableName(pgSchema, pgTable),
        validColumns: response.validColumns,
      },
      'postgres'
    );
    const processedRows = postProcessAggregates(rows, compiled);
    const totalRecords = computeTotalRecordCount(rows);

    const groups: GroupComputationResult[] = dashboardGroupsConfig
      .filter(cfg => cfg.enabled)
      .map(cfg => {
        const groupDef = params.groups.find(g => g.id === cfg.groupId);
        const buildVirtualMetrics = (processed: Record<string, number | null>): VirtualMetricValue[] =>
          virtualMetrics.map(vm => {
            const binding = cfg.virtualMetricBindings?.find(b => b.virtualMetricId === vm.id);
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
            const numericValue = typeof processed[alias] === 'number' ? processed[alias] : null;
            return {
              virtualMetricId: vm.id,
              virtualMetricName: vm.name,
              value: numericValue,
              formattedValue: formatValue(numericValue, vm.displayFormat, vm.decimalPlaces, vm.unit),
              sourceMetricId: binding.metricId,
            };
          });

        const breakdown = groupByColumn
          ? processedRows
              .map((processed, idx) => {
                const rawLabel = rows[idx]['_group_label'];
                const label = rawLabel == null ? '' : String(rawLabel).trim();
                const rowRc = rows[idx]['_record_count'];
                const recordCount =
                  typeof rowRc === 'number' ? rowRc
                  : typeof rowRc === 'bigint' ? Number(rowRc) : 0;
                return { label, recordCount, virtualMetrics: buildVirtualMetrics(processed) };
              })
              .filter(item => item.label !== '')
          : undefined;

        const summaryProcessed = groupByColumn
          ? aggregateProcessedRows(processedRows, compiled.aggregateMetadata, compiled.formulas)
          : processedRows[0] || {};

        return {
          groupId: cfg.groupId,
          groupName: groupDef?.name ?? `Группа ${cfg.groupId}`,
          virtualMetrics: buildVirtualMetrics(summaryProcessed),
          breakdown,
          breakdownTruncated,
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

  dispose(): void {}
}