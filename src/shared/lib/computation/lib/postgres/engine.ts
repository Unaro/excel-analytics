// features/computation/lib/postgres/engine.ts
import type { ClientComputeParams, CompiledQuery, IComputeEngine, MetricAggregationMeta } from '../types';
import { compileQuery } from '../query-compiler';
import { getActiveFilter, formatValue } from '../utils';
import { postProcessAggregates, recalculateFormulasOnAggregated } from '../post-process';
import { useDatasetStore } from '@/entities/dataset';
import { decryptConfig } from '@/shared/lib/utils/crypto';
import type { PgConnectionConfig } from '@/shared/api/postgres/client';
import { DashboardComputationResult, GroupComputationResult, VirtualMetricValue } from '@/entities/metric';
import { computePgMetrics } from '@/shared/api/server-actions';
import { aggregateProcessedRows } from '../aggregation';

/**
 * Безопасное экранирование SQL-идентификаторов (schema, table, column).
 * Двойные кавычки + экранирование внутренних кавычек.
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


/**
 * PostgreSQL Compute Engine.
 * 
 * Архитектура:
 * 1. Получаем реальное имя таблицы из dataset store (schema.table)
 * 2. Дешифруем PG-конфиг на клиенте (ключ в localStorage)
 * 3. Передаём дешифрованный конфиг в Server Action (тонкий RPC)
 * 4. Server Action выполняет SQL через `postgres` npm-пакет
 * 5. post-process считает calculated метрики и формирует breakdown
 */
export class PgEngine implements IComputeEngine {
  async initialize(): Promise<void> {
    // PG не требует инициализации (соединения создаются per-request в Server Action)
  }

  async compute(params: ClientComputeParams): Promise<DashboardComputationResult> {
    const {
      dashboardId,
      encryptedConfig,
      dashboardGroupsConfig,
      virtualMetrics,
      filters,
      datasetId,
      groupByColumn
    } = params;

    if (!encryptedConfig) {
      throw new Error('Missing encryptedConfig for PostgreSQL');
    }

    // ─────────────────────────────────────────────────────────────
    // 1. Получаем реальное имя таблицы из dataset store
    // ─────────────────────────────────────────────────────────────
    const dataset = useDatasetStore.getState().datasets[datasetId];
    if (!dataset?.pgConfig?.schema || !dataset.pgConfig.table) {
      throw new Error(`PostgreSQL dataset ${datasetId} missing schema/table config`);
    }
    const realTableName = `${quoteIdent(dataset.pgConfig.schema)}.${quoteIdent(dataset.pgConfig.table)}`;

    const start = Date.now();

    // ─────────────────────────────────────────────────────────────
    // 2. Дешифруем конфиг на клиенте (ключ в localStorage)
    // ─────────────────────────────────────────────────────────────
    const decryptedConfig = await decryptConfig<PgConnectionConfig>(encryptedConfig);

    // ─────────────────────────────────────────────────────────────
    // 3. Подменяем tableName на реальное имя
    // ─────────────────────────────────────────────────────────────
    const pgParams: ClientComputeParams = {
      ...params,
      tableName: realTableName,
    };

    // ─────────────────────────────────────────────────────────────
    // 4. Выполняем SQL через Server Action
    // ─────────────────────────────────────────────────────────────
    const response = await computePgMetrics(pgParams, decryptedConfig);

    if (!response.success) {
      throw new Error('PG query failed: no data returned');
    }

    const rows = response.rows as Record<string, unknown>[];

    // ─────────────────────────────────────────────────────────────
    // 5. Post-process: считаем calculated метрики
    // ─────────────────────────────────────────────────────────────
    const { formulas, aggregateMetadata } = compileQuery(pgParams, 'postgres');
    const processedRows = postProcessAggregates(rows, formulas);

    // ─────────────────────────────────────────────────────────────
    // 6. Общее количество обработанных записей
    // ─────────────────────────────────────────────────────────────
    const firstRow = rows[0] || {};
    const totalRecords = typeof firstRow['_record_count'] === 'number'
      ? firstRow['_record_count']
      : typeof firstRow['_record_count'] === 'bigint'
      ? Number(firstRow['_record_count'])
      : rows.length;

    // ─────────────────────────────────────────────────────────────
    // 7. Формируем группы с поддержкой breakdown (drill-down)
    // ─────────────────────────────────────────────────────────────
    const groups: GroupComputationResult[] = dashboardGroupsConfig
      .filter(cfg => cfg.enabled)
      .map(cfg => {
        const groupDef = params.groups.find(g => g.id === cfg.groupId);

        // Хелпер для построения virtualMetrics из processed строки
        const buildVirtualMetrics = (processed: Record<string, number | null>): VirtualMetricValue[] => {
          return virtualMetrics.map(vm => {
            const binding = cfg.virtualMetricBindings?.find(b => b.virtualMetricId === vm.id);
            if (!binding) {
              return {
                virtualMetricId: vm.id,
                virtualMetricName: vm.name,
                value: null,
                formattedValue: '—',
                sourceMetricId: ''
              };
            }
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
        };

        // ─────────────────────────────────────────────────────────
        // BREAKDOWN: разбивка по дочерним элементам (для drill-down)
        // ─────────────────────────────────────────────────────────
        const breakdown = groupByColumn
          ? processedRows
              .map((processed, idx) => {
                const rawLabel = rows[idx]['_group_label'];
                // Нормализуем label: null/undefined → '', + trim
                const label = rawLabel === null || rawLabel === undefined
                  ? ''
                  : String(rawLabel).trim();

                const recordCount = typeof rows[idx]['_record_count'] === 'number'
                  ? rows[idx]['_record_count'] as number
                  : Number(rows[idx]['_record_count'] ?? 0);

                return {
                  label,
                  recordCount,
                  virtualMetrics: buildVirtualMetrics(processed),
                };
              })
              .filter(item => item.label !== '')
          : undefined;

        // ─────────────────────────────────────────────────────────
        // SUMMARY: сводные значения (сумма по всем строкам breakdown)
        // ─────────────────────────────────────────────────────────
        const summaryProcessed = groupByColumn
          ? aggregateProcessedRows(processedRows, aggregateMetadata, formulas)
          : (processedRows[0] || {});

        return {
          groupId: cfg.groupId,
          groupName: groupDef?.name ?? `Группа ${cfg.groupId}`,
          virtualMetrics: buildVirtualMetrics(summaryProcessed),
          breakdown,
          recordCount: totalRecords,
          computedAt: Date.now()
        };
      });

    // ─────────────────────────────────────────────────────────────
    // 8. Финальный результат
    // ─────────────────────────────────────────────────────────────
    return {
      dashboardId,
      hierarchyFilters: filters,
      activeFilter: getActiveFilter(filters),
      virtualMetrics,
      groups,
      totalRecords,
      computedAt: Date.now(),
      computationTime: Date.now() - start
    };
  }

  dispose(): void {
    // Соединения закрываются автоматически в Server Action
  }
}