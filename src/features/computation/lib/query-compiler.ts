import type { ComputeDialect, CompiledQuery, QueryParam, ClientComputeParams } from './types';

const quote = (id: string) => `"${id.replace(/"/g, '""')}"`;

function escapeDuckDBValue(val: QueryParam): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  return `'${String(val).replace(/'/g, "''")}'`;
}

/**
 * Приведение к числовому типу для агрегаций.
 * COUNT/COUNT_DISTINCT работают с любыми типами, остальные требуют число.
 */
function castToNumeric(expr: string, dialect: ComputeDialect): string {
  if (dialect === 'duckdb') return `TRY_CAST(${expr} AS DOUBLE)`;
  return `NULLIF(${expr}, '')::DOUBLE PRECISION`;
}

/**
 * Оборачивает колонку в агрегатную функцию с учётом диалекта и типа.
 */
function buildAggregateExpr(
  columnName: string,
  aggregateFn: string,
  dialect: ComputeDialect
): string {
  const col = quote(columnName);
  const fn = aggregateFn.toUpperCase();
  
  // COUNT и COUNT_DISTINCT работают с любыми типами
  if (fn === 'COUNT') return `COUNT(${col})`;
  if (fn === 'COUNT_DISTINCT') return `COUNT(DISTINCT ${col})`;
  
  // Остальные требуют числового приведения
  const castedCol = castToNumeric(col, dialect);
  
  if (fn === 'MEDIAN') {
    return dialect === 'duckdb' 
      ? `MEDIAN(${castedCol})` 
      : `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${castedCol})`;
  }
  
  return `${fn}(${castedCol})`;
}

export function compileQuery(params: ClientComputeParams, dialect: ComputeDialect): CompiledQuery {
  const { filters, groups, dashboardGroupsConfig, metricTemplates, tableName, groupByColumn } = params;
  
  const formulas: CompiledQuery['formulas'] = new Map();
  const selectParts: string[] = [];
  const pgParams: QueryParam[] = [];
  const whereConditions: string[] = [];

  if (groupByColumn) {
    selectParts.push(`${quote(groupByColumn)} AS "_group_label"`);
  }

  selectParts.push(`COUNT(*) AS "_record_count"`);

  // 1. WHERE Clause
  if (filters.length > 0) {
    filters.forEach((f) => {
      const col = quote(f.columnName);
      if (dialect === 'postgres') {
        if (f.operator === 'between' && f.value2 != null) {
          whereConditions.push(`${col} BETWEEN $${pgParams.length + 1} AND $${pgParams.length + 2}`);
          pgParams.push(f.value as QueryParam, f.value2 as QueryParam);
        } else {
          const op = f.operator && f.operator !== 'exact' ? f.operator : '=';
          whereConditions.push(`${col} ${op} $${pgParams.length + 1}`);
          pgParams.push(f.value as QueryParam);
        }
      } else {
        if (f.operator === 'between' && f.value2 != null) {
          whereConditions.push(`${col} BETWEEN ${escapeDuckDBValue(f.value)} AND ${escapeDuckDBValue(f.value2)}`);
        } else {
          const op = f.operator && f.operator !== 'exact' ? f.operator : '=';
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
        
        const expr = buildAggregateExpr(binding.columnName, tpl.aggregateFunction, dialect);
        selectParts.push(`${expr} AS ${quote(alias)}`);
      }
      // ═══════════════════════════════════════════════════════════
      // CALCULATED: fieldBindings → SQL, metricBindings → post-process
      // ═══════════════════════════════════════════════════════════
      else if (tpl.type === 'calculated' && tpl.formula) {
        const baseAlias = `base_${alias}`;
        
        const fieldDependencies = metric.fieldBindings.map(fb => {
          const aggregateFn = 'SUM';
          const depAlias = `${baseAlias}__${fb.fieldAlias}`;
          const expr = buildAggregateExpr(fb.columnName, aggregateFn, dialect);
          selectParts.push(`${expr} AS ${quote(depAlias)}`);
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
  
  if (groupByColumn) {
    groupByClause = `GROUP BY ${quote(groupByColumn)}`;
    const firstMetricAlias = selectParts.find(p => p.includes('__') && !p.includes('_record_count'));
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
    formulas
  };
}