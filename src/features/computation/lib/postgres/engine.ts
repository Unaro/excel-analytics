// features/computation/lib/postgres/engine.ts
import type { ClientComputeParams, CompiledQuery, IComputeEngine, MetricAggregationMeta } from '../types';
import { computePgMetrics } from '@/app/actions/pg-compute';
import { compileQuery } from '../query-compiler';
import { getActiveFilter, formatValue } from '../utils';
import { postProcessAggregates, recalculateFormulasOnAggregated } from '../post-process';
import { useDatasetStore } from '@/entities/dataset';
import { decryptConfig } from '@/shared/lib/utils/crypto';
import type { PgConnectionConfig } from '@/shared/api/postgres/client';
import { DashboardComputationResult, GroupComputationResult, VirtualMetricValue } from '@/entities/metric';

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

function aggregateProcessedRows(
  processedRows: Record<string, number | null>[],
  aggregateMetadata: Map<string, MetricAggregationMeta>,
  formulas: CompiledQuery['formulas']
): Record<string, number | null> {
  // ... тот же код что и в worker.ts ...
  if (processedRows.length === 0) return {};

  const summary: Record<string, number | null> = {};
  const keys = Object.keys(processedRows[0]);

  for (const key of keys) {
    if (key.startsWith('__agg_sum__') || key.startsWith('__agg_count__')) {
      summary[key] = null;
      continue;
    }
    if (key === '_group_label' || key === '_record_count') continue;

    const meta = aggregateMetadata.get(key);
    const values = processedRows
      .map(row => row[key])
      .filter((v): v is number => typeof v === 'number' && isFinite(v));

    if (values.length === 0) { summary[key] = null; continue; }

    switch (meta?.aggregateFunction) {
      case 'SUM':
      case 'COUNT':
      case 'COUNT_DISTINCT':
        summary[key] = values.reduce((a, b) => a + b, 0);
        break;
      case 'AVG': {
        const sumKey = `__agg_sum__${key}`;
        const countKey = `__agg_count__${key}`;
        let totalSum = 0, totalCount = 0;
        for (const row of processedRows) {
          totalSum += (typeof row[sumKey] === 'number' ? row[sumKey] : 0);
          totalCount += (typeof row[countKey] === 'number' ? row[countKey] : 0);
        }
        summary[key] = totalCount > 0 ? totalSum / totalCount : null;
        break;
      }
      case 'MAX':
        summary[key] = Math.max(...values);
        break;
      case 'MIN':
        summary[key] = Math.min(...values);
        break;
      case 'MEDIAN':
      case 'PERCENTILE': {
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        summary[key] = sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];
        break;
      }
      default:
        summary[key] = values.reduce((a, b) => a + b, 0);
    }
  }

  if (formulas.size > 0) {
    const recalculated = recalculateFormulasOnAggregated(summary, formulas);
    for (const [key, val] of Object.entries(recalculated)) {
      if (!key.startsWith('__agg_') && !key.startsWith('base_')) {
        summary[key] = val;
      }
    }
  }

  return summary;
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