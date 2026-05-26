import type { ComputeDialect, CompiledQuery, QueryParam, ClientComputeParams } from './types';

const quote = (id: string) => `"${id.replace(/"/g, '""')}"`;

/**
 * Оборачивает выражение в приведение к числовому типу.
 * 
 * Для DuckDB: TRY_CAST(... AS DOUBLE) — возвращает NULL вместо ошибки
 *   если значение не число (строка "—", "" и т.д.).
 * Для Postgres: NULLIF(..., '')::DOUBLE PRECISION — превращает пустые
 *   строки в NULL и приводит к DOUBLE.
 * 
 * Не применяется для COUNT — он работает с любыми типами.
 */
function castToNumeric(expr: string, dialect: ComputeDialect): string {
  if (dialect === 'duckdb') {
    return `TRY_CAST(${expr} AS DOUBLE)`;
  } else {
    return `NULLIF(${expr}, '')::DOUBLE PRECISION`;
  }
}

function escapeDuckDBValue(val: QueryParam): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  return `'${String(val).replace(/'/g, "''")}'`;
}

export function compileQuery(params: ClientComputeParams, dialect: ComputeDialect): CompiledQuery {
  const { filters, groups, dashboardGroupsConfig, metricTemplates, tableName } = params;

  const formulas: CompiledQuery['formulas'] = new Map();
  const selectParts: string[] = [];
  const pgParams: QueryParam[] = [];
  const whereConditions: string[] = [];

  // 1. WHERE Clause (без изменений)
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

      if (tpl.type === 'aggregate' && tpl.aggregateFunction && tpl.aggregateField) {
        const binding = metric.fieldBindings.find(b => b.fieldAlias === tpl.aggregateField);
        if (!binding) continue;
        const col = quote(binding.columnName);
        let fn = tpl.aggregateFunction.toUpperCase();

        // ✅ НОВОЕ: COUNT работает с любым типом, остальные требуют число
        const needsNumericCast = !['COUNT', 'COUNT_DISTINCT'].includes(fn);
        const castedCol = needsNumericCast ? castToNumeric(col, dialect) : col;

        if (fn === 'COUNT_DISTINCT') fn = 'COUNT(DISTINCT';
        if (fn === 'MEDIAN') {
          fn = dialect === 'duckdb' ? 'MEDIAN' : 'PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY';
        }

        if (fn.startsWith('PERCENTILE')) {
          selectParts.push(`${fn} ${castedCol}) AS ${quote(alias)}`);
        } else if (fn === 'COUNT(DISTINCT') {
          selectParts.push(`${fn} ${col}) AS ${quote(alias)}`);
        } else {
          selectParts.push(`${fn}(${castedCol}) AS ${quote(alias)}`);
        }
      }
      else if (tpl.type === 'calculated' && tpl.formula) {
        const baseAlias = `base_${alias}`;
        // ✅ НОВОЕ: зависимости в calculated метриках тоже кастуются
        const dependencies = metric.fieldBindings.map(b => ({
          alias: b.fieldAlias,
          baseExpr: `SUM(${castToNumeric(quote(b.columnName), dialect)})`
        }));

        selectParts.push(`(${dependencies.map(d => d.baseExpr).join(' + ')}) AS ${quote(baseAlias)}`);

        formulas.set(baseAlias, {
          groupId: cfg.groupId,
          metricId: metric.id,
          templateId: tpl.id,
          formula: tpl.formula,
          dependencies
        });
      }
    }
  }

  return {
    sql: selectParts.length > 0
      ? `SELECT ${selectParts.join(', ')} FROM ${tableName} ${whereClause}`
      : `SELECT 1 AS dummy`,
    params: dialect === 'postgres' ? pgParams : undefined,
    formulas
  };
}