/// <reference lib="webworker" />

import { logger } from '@/shared/lib/logger';
import type * as duckdb from '@duckdb/duckdb-wasm';
import { compileQuery, BREAKDOWN_LIMIT } from '../../../query-compiler';
import { postProcessAggregates } from '../../../post-process';
import { getActiveFilter, buildGroupVirtualMetrics, computeTotalRecordCount } from '../../../utils';
import { aggregateProcessedRows } from '../../../aggregation';
import { buildTableName } from '../../table-name';
import { preparedStatementCache } from '../../prepared-statement-cache';
import { requireConn, schemaCache } from '../runtime';
import { takeCancelled } from '../cancel';
import { logComputeTimings } from '../lib';
import type { ComputePayload } from '../messages';

/**
 * COMPUTE — основной запрос дашборда/группы: DESCRIBE (схема, с кэшем) →
 * compile → exec → build групп. С контрольными точками отмены между этапами.
 */
export async function handleCompute(id: number, payload: ComputePayload): Promise<void> {
  const conn = requireConn();
  const { params } = payload;
  const { dashboardId, dashboardGroupsConfig, virtualMetrics, filters, groupByColumn } = params;
  const tableName = buildTableName(params.datasetId);

  // Контрольная точка отмены: true — задача снята, ответ уже отправлен.
  const abortIfCancelled = (): boolean => {
    if (!takeCancelled(id)) return false;
    self.postMessage({ id, success: false, error: 'AbortError' });
    return true;
  };

  if (abortIfCancelled()) return;

  // Профилирование COMPUTE по фазам (см. ROADMAP «Оптимизация вычислений
  // главного дашборда»): describe → compile → exec → build.
  const tComputeStart = performance.now();

  // ─── ПОЛУЧАЕМ РЕАЛЬНУЮ СХЕМУ ИЗ DUCKDB (с кэшем) ───────
  let effectiveParams = params;
  try {
    let realColumns = schemaCache.get(tableName);
    if (!realColumns) {
      const schemaResult = await conn.query(`DESCRIBE ${tableName}`);
      realColumns = schemaResult.toArray().map(
        (r) => (r as Record<string, unknown>)['column_name'] as string
      );
      if (realColumns.length > 0) schemaCache.set(tableName, realColumns);
      logger.debug(
        `[Worker] 🔍 DESCRIBE ${tableName}: ${realColumns.length} columns`,
        realColumns
      );
    }
    if (realColumns.length > 0) {
      effectiveParams = { ...params, validColumns: realColumns };
    }
  } catch (schemaErr) {
    logger.warn(
      `[Worker] ⚠️ DESCRIBE failed for ${tableName}, falling back to params.validColumns:`,
      schemaErr
    );
  }

  const tAfterDescribe = performance.now();

  const compiled = compileQuery(effectiveParams, 'duckdb');

  logger.debug(`[Worker] 📝 Compiled SQL (${compiled.sql.length} chars):`, compiled.sql.slice(0, 200) + '...');

  const tAfterCompile = performance.now();

  // Отмена могла прийти, пока ждали DESCRIBE — не запускаем тяжёлый SQL
  if (abortIfCancelled()) return;

  const prepared = await preparedStatementCache.getOrCreate(compiled.sql);
  let table: Awaited<ReturnType<duckdb.AsyncDuckDBConnection['query']>>;

  if (prepared) {
    table = await prepared.query();
  } else {
    table = await conn.query(compiled.sql);
  }

  const tAfterExec = performance.now();

  // SQL уже исполнен, но пост-обработка и сериализация результата
  // отменённой задачи никому не нужны
  if (abortIfCancelled()) return;

  const allRows = table.toArray() as Record<string, unknown>[];
  // Есть ли группировка (категориальная и/или временна́я)
  const hasGrouping = !!(groupByColumn || params.groupByDateColumn);
  // SQL запрашивает BREAKDOWN_LIMIT + 1 строк: наличие лишней строки —
  // признак усечения. Обрезаем ДО пост-обработки, чтобы сводка («Итого»)
  // и breakdown считались по одному набору строк.
  const breakdownTruncated =
    hasGrouping && allRows.length > BREAKDOWN_LIMIT;
  const rows = breakdownTruncated ? allRows.slice(0, BREAKDOWN_LIMIT) : allRows;
  const processedRows = postProcessAggregates(rows, compiled);


  const groups = dashboardGroupsConfig
    .filter(cfg => cfg.enabled)
    .map(cfg => {
      const groupDef = effectiveParams.groups.find(g => g.id === cfg.groupId);

      const breakdownItems = hasGrouping
        ? processedRows
            .map((processed, idx) => {
              const rawLabel = rows[idx]['_group_label'];
              const label =
                rawLabel === null || rawLabel === undefined
                  ? ''
                  : String(rawLabel).trim();
              const rawDate = rows[idx]['_date_label'];
              const dateLabel =
                rawDate === null || rawDate === undefined
                  ? undefined
                  : String(rawDate).trim();
              const rowRc = rows[idx]['_record_count'];
              const recordCount =
                typeof rowRc === 'number'
                  ? rowRc
                  : typeof rowRc === 'bigint'
                    ? Number(rowRc)
                    : 0;
              const groupVirtualMetrics = buildGroupVirtualMetrics(
                virtualMetrics,
                cfg,
                processed
              );
              return { label, dateLabel, recordCount, virtualMetrics: groupVirtualMetrics };
            })
            .filter(item => item.label !== '')
        : undefined;

      let summaryProcessed: Record<string, number | null>;
      if (hasGrouping) {
        summaryProcessed = aggregateProcessedRows(
          processedRows,
          compiled.aggregateMetadata,
          compiled.formulas
        );
      } else {
        summaryProcessed = processedRows[0] || {};
      }

      const groupVirtualMetrics = buildGroupVirtualMetrics(
        virtualMetrics,
        cfg,
        summaryProcessed
      );

      return {
        groupId: cfg.groupId,
        groupName: groupDef?.name ?? `Группа ${cfg.groupId}`,
        virtualMetrics: groupVirtualMetrics,
        breakdown: breakdownItems,
        breakdownTruncated,
        recordCount: computeTotalRecordCount(rows),
        computedAt: Date.now(),
      };
    });

  const result = {
    dashboardId,
    hierarchyFilters: filters,
    activeFilter: getActiveFilter(filters),
    virtualMetrics,
    groups,
    totalRecords: computeTotalRecordCount(rows),
    computedAt: Date.now(),
  };

  const tBuildEnd = performance.now();
  logComputeTimings({
    describeMs: tAfterDescribe - tComputeStart,
    compileMs: tAfterCompile - tAfterDescribe,
    execMs: tAfterExec - tAfterCompile,
    buildMs: tBuildEnd - tAfterExec,
    sqlRows: allRows.length,
    groups: groups.length,
  });

  self.postMessage({ id, success: true, result });
}
