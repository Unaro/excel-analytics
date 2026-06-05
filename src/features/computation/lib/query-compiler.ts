import type { ComputeDialect, CompiledQuery, QueryParam, ClientComputeParams, MetricAggregationMeta } from './types';

const quote = (id: string) => `"${id.replace(/"/g, '""')}"`;

// ─────────────────────────────────────────────────────────────
// Whitelist разрешённых SQL-операторов для WHERE-условий.
// Defence-in-depth: даже если Zod-схема валидирует на входе,
// данные могут прийти из кэша/импорта/старой версии схемы.
// ─────────────────────────────────────────────────────────────
const ALLOWED_OPERATORS = new Set([
  '=', '>', '<', '>=', '<=', '!=', '<>',
  'LIKE', 'ILIKE', 'BETWEEN',
]);

/**
 * Нормализует оператор:
 *  - 'exact' и undefined → '='
 *  - всё, что не в whitelist → '=' (с console.warn)
 *  - 'between' (любой регистр) → 'BETWEEN'
 */
function sanitizeOperator(op: string | undefined): string {
  if (!op || op === 'exact') return '=';
  const normalized = op.toUpperCase();
  if (!ALLOWED_OPERATORS.has(normalized)) {
    console.warn(`[query-compiler] Blocked invalid operator: ${op}`);
    return '=';
  }
  return op === 'between' ? 'BETWEEN' : op;
}

/**
 * Экранирует значение для inline-вставки в SQL (DuckDB).
 * Возвращает 'NULL' для любых не-примитивных типов —
 * никогда не строим SQL из объектов/массивов.
 */
function escapeDuckDBValue(val: QueryParam): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') {
    if (!isFinite(val)) return 'NULL'; // защита от NaN/Infinity
    return String(val);
  }
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'string') {
    const escaped = val
      .replace(/\\/g, '\\\\')     // экранируем обратные слэши
      .replace(/'/g, "''")         // одинарные кавычки
      .replace(/\0/g, '');         // null-byte injection
    return `'${escaped}'`;
  }
  // Fallback: объекты, массивы, функции → NULL
  console.warn(`[query-compiler] Unexpected value type: ${typeof val}`);
  return 'NULL';
}

function castToNumeric(expr: string, dialect: ComputeDialect): string {
  if (dialect === 'duckdb') return `TRY_CAST(${expr} AS DOUBLE)`;
  return `NULLIF(${expr}, '')::DOUBLE PRECISION`;
}

function buildAggregateExpr(
  columnName: string,
  aggregateFn: string,
  dialect: ComputeDialect
): string {
  const col = quote(columnName);
  const fn = aggregateFn.toUpperCase();

  if (fn === 'COUNT') return `COUNT(${col})`;
  if (fn === 'COUNT_DISTINCT') return `COUNT(DISTINCT ${col})`;

  const castedCol = castToNumeric(col, dialect);

  if (fn === 'MEDIAN') {
    return dialect === 'duckdb'
      ? `MEDIAN(${castedCol})`
      : `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${castedCol})`;
  }

  return `${fn}(${castedCol})`;
}

export function compileQuery(params: ClientComputeParams, dialect: ComputeDialect): CompiledQuery {
  const { filters, groups, dashboardGroupsConfig, metricTemplates, tableName, groupByColumn, validColumns } = params;

  const isColumnValid = (colName: string) => {
    if (!validColumns) return true; // Fallback, если список не передан
    return validColumns.includes(colName);
  };

  const formulas: CompiledQuery['formulas'] = new Map();
  const aggregateMetadata = new Map<string, MetricAggregationMeta>();
  const selectParts: string[] = [];
  const pgParams: QueryParam[] = [];
  const whereConditions: string[] = [];

  let safeGroupByColumn: string | undefined = undefined;
  if (groupByColumn) {
    if (isColumnValid(groupByColumn)) {
      selectParts.push(`${quote(groupByColumn)} AS "_group_label"`);
      safeGroupByColumn = groupByColumn;
    } else {
      selectParts.push(`NULL AS "_group_label"`);
    }
  }
  selectParts.push(`COUNT(*) AS "_record_count"`);

  // 1. WHERE Clause
  if (filters.length > 0) {
    filters.forEach((f) => {
      if (!isColumnValid(f.columnName)) return;
      const col = quote(f.columnName);
      const op = sanitizeOperator(f.operator);

      if (dialect === 'postgres') {
        if (op === 'BETWEEN' && f.value2 != null) {
          whereConditions.push(`${col} BETWEEN $${pgParams.length + 1} AND $${pgParams.length + 2}`);
          pgParams.push(f.value as QueryParam, f.value2 as QueryParam);
        } else {
          whereConditions.push(`${col} ${op} $${pgParams.length + 1}`);
          pgParams.push(f.value as QueryParam);
        }
      } else {
        if (op === 'BETWEEN' && f.value2 != null) {
          whereConditions.push(`${col} BETWEEN ${escapeDuckDBValue(f.value)} AND ${escapeDuckDBValue(f.value2)}`);
        } else {
          whereConditions.push(`${col} ${op} ${escapeDuckDBValue(f.value)}`);
        }
      }
    });
  }
  
  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  // 2. SELECT Clause
  for (const cfg of dashboardGroupsConfig) {
    if (!cfg.enabled) continue;

    const groupDef = groups.find(g => g.id === cfg.groupId);
    if (!groupDef) continue;

    for (const metric of groupDef.metrics) {
      if (!metric.enabled) continue;

      const tpl = metricTemplates.find(t => t.id === metric.templateId);
      if (!tpl) continue;

      const alias = `${cfg.groupId}__${metric.id}`;

      // ═══════════════════════════════════════════════════════════
      // AGGREGATE: идёт в SQL как SUM/AVG/COUNT/etc.
      // ═══════════════════════════════════════════════════════════
      if (tpl.type === 'aggregate' && tpl.aggregateFunction && tpl.aggregateField) {
        const binding = metric.fieldBindings.find(b => b.fieldAlias === tpl.aggregateField);
        if (!binding) continue;
        
        const fn = tpl.aggregateFunction.toUpperCase();
        
        // ЕСЛИ КОЛОНКА УДАЛЕНА ИЛИ СКРЫТА
        if (!isColumnValid(binding.columnName)) {
          selectParts.push(`NULL AS ${quote(alias)}`);
          aggregateMetadata.set(alias, { aggregateFunction: tpl.aggregateFunction });
          if (fn === 'AVG') {
            selectParts.push(`NULL AS ${quote(`__agg_sum__${alias}`)}`);
            selectParts.push(`NULL AS ${quote(`__agg_count__${alias}`)}`);
          }
          continue;
        }

        const expr = buildAggregateExpr(binding.columnName, fn, dialect);
        selectParts.push(`${expr} AS ${quote(alias)}`);
        aggregateMetadata.set(alias, { aggregateFunction: tpl.aggregateFunction });
        if (fn === 'AVG') {
          const castedCol = castToNumeric(quote(binding.columnName), dialect);
          selectParts.push(`SUM(${castedCol}) AS ${quote(`__agg_sum__${alias}`)}`);
          selectParts.push(`COUNT(${quote(binding.columnName)}) AS ${quote(`__agg_count__${alias}`)}`);
        }
      }
      // ═══════════════════════════════════════════════════════════
      // CALCULATED
      // ═══════════════════════════════════════════════════════════
      else if (tpl.type === 'calculated' && tpl.formula) {
        const baseAlias = `base_${alias}`;
        const fieldDependencies = metric.fieldBindings.map(fb => {
          const depAlias = `${baseAlias}__${fb.fieldAlias}`;
          const aggregateFn = 'SUM';
          
          if (!isColumnValid(fb.columnName)) {
            selectParts.push(`NULL AS ${quote(depAlias)}`);
          } else {
            const expr = buildAggregateExpr(fb.columnName, aggregateFn, dialect);
            selectParts.push(`${expr} AS ${quote(depAlias)}`);
          }
          
          return {
            alias: fb.fieldAlias,
            columnName: fb.columnName,
            aggregateFn,
          };
        });

        const metricDependencies = metric.metricBindings.map(mb => ({
          alias: mb.metricAlias,
          metricId: mb.metricId,
        }));

        formulas.set(baseAlias, {
          groupId: cfg.groupId,
          metricId: metric.id,
          templateId: tpl.id,
          formula: tpl.formula,
          fieldDependencies,
          metricDependencies,
        });
      }
    }
  }

  let groupByClause = '';
  let orderByClause = '';
  let limitClause = '';

  if (safeGroupByColumn) {
    groupByClause = `GROUP BY ${quote(safeGroupByColumn)}`;
    const firstMetricAlias = selectParts.find(p => p.includes('__') && !p.includes('_record_count') && !p.startsWith('NULL'));
    if (firstMetricAlias) {
      const match = firstMetricAlias.match(/AS "([^"]+)"/);
      if (match) {
        orderByClause = `ORDER BY ${quote(match[1])} DESC`;
      }
    }
    limitClause = 'LIMIT 1000';
  }
  
  const parts = [
    `SELECT ${selectParts.join(', ')}`,
    `FROM ${tableName}`,
    whereClause,
    groupByClause,
    orderByClause,
    limitClause,
  ].filter(Boolean);

  return {
    sql: parts.join(' '),
    params: dialect === 'postgres' ? pgParams : undefined,
    formulas,
    aggregateMetadata,
  };
}