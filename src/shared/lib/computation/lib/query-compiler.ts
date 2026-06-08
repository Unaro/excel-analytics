import type {
  ComputeDialect,
  CompiledQuery,
  CompiledFormulaMeta,
  QueryParam,
  ClientComputeParams,
  MetricAggregationMeta,
} from './types';
import {
  FormulaToSqlCompiler,
  createFormulaToSqlContext,
  wrapWithCoalesce,
} from './formula-to-sql';

const quote = (id: string) => `"${id.replace(/"/g, '""')}"`;

// ─────────────────────────────────────────────────────────────
// Whitelist SQL-операторов для WHERE
// ─────────────────────────────────────────────────────────────
const ALLOWED_OPERATORS = new Set([
  '=', '>', '<', '>=', '<=', '!=', '<>',
  'LIKE', 'ILIKE', 'BETWEEN',
]);

function sanitizeOperator(op: string | undefined): string {
  if (!op || op === 'exact') return '=';
  const normalized = op.toUpperCase();
  if (!ALLOWED_OPERATORS.has(normalized)) {
    console.warn(`[query-compiler] Blocked invalid operator: ${op}`);
    return '=';
  }
  return op === 'between' ? 'BETWEEN' : op;
}

function escapeDuckDBValue(val: QueryParam): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') {
    if (!isFinite(val)) return 'NULL';
    return String(val);
  }
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'string') {
    const escaped = val
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "''")
      .replace(/\0/g, '');
    return `'${escaped}'`;
  }
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

// ─────────────────────────────────────────────────────────────
// Префиксы для технических алиасов
// ─────────────────────────────────────────────────────────────
const FIELD_DEP_PREFIX = '__fb_';
const BASE_CTE_NAME = '__base';
const CALC_CTE_PREFIX = '__calc_';

// ─────────────────────────────────────────────────────────────
// Topological sort для calculated-метрик
// ─────────────────────────────────────────────────────────────
interface CalculatedMetricEntry {
  baseAlias: string;          // "base_group1__metric1"
  finalAlias: string;          // "group1__metric1"
  formula: string;
  groupId: string;
  metricId: string;
  templateId: string;
  fieldDependencies: CompiledFormulaMeta['fieldDependencies'];
  metricDependencies: CompiledFormulaMeta['metricDependencies'];
}

function topologicalSortCalculated(
  metrics: CalculatedMetricEntry[]
): CalculatedMetricEntry[] {
  const byFinalAlias = new Map<string, CalculatedMetricEntry>();
  for (const m of metrics) byFinalAlias.set(m.finalAlias, m);

  const sorted: CalculatedMetricEntry[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const visit = (finalAlias: string): void => {
    if (visited.has(finalAlias)) return;
    if (visiting.has(finalAlias)) {
      console.warn(
        `[query-compiler] Circular dependency detected at "${finalAlias}", skipping`
      );
      return;
    }
    visiting.add(finalAlias);
    const entry = byFinalAlias.get(finalAlias);
    if (entry) {
      for (const dep of entry.metricDependencies) {
        // Ищем метрику, у которой metricId === dep.metricId
        const depEntry = metrics.find((m) => m.metricId === dep.metricId);
        if (depEntry) visit(depEntry.finalAlias);
      }
    }
    visiting.delete(finalAlias);
    visited.add(finalAlias);
    if (entry) sorted.push(entry);
  };

  for (const m of metrics) visit(m.finalAlias);
  return sorted;
}

// ─────────────────────────────────────────────────────────────
// Главная функция
// ─────────────────────────────────────────────────────────────
export function compileQuery(
  params: ClientComputeParams,
  dialect: ComputeDialect
): CompiledQuery {
  const {
    filters,
    groups,
    dashboardGroupsConfig,
    metricTemplates,
    tableName,
    groupByColumn,
    validColumns,
  } = params;

  const isColumnValid = (colName: string): boolean =>
    !validColumns || validColumns.includes(colName);

  const formulas = new Map<string, CompiledFormulaMeta>();
  const aggregateMetadata = new Map<string, MetricAggregationMeta>();
  const calculatedInSqlAliases = new Set<string>();

  const baseSelectParts: string[] = [];
  const pgParams: QueryParam[] = [];
  const whereConditions: string[] = [];
  const calculatedMetrics: CalculatedMetricEntry[] = [];

  let safeGroupByColumn: string | undefined;

  if (groupByColumn) {
    if (isColumnValid(groupByColumn)) {
      baseSelectParts.push(`${quote(groupByColumn)} AS "_group_label"`);
      safeGroupByColumn = groupByColumn;
    } else {
      baseSelectParts.push(`NULL AS "_group_label"`);
    }
  }
  baseSelectParts.push(`COUNT(*) AS "_record_count"`);

  // ───────────────────────────────────────────────────────────
  // WHERE clause
  // ───────────────────────────────────────────────────────────
  for (const f of filters) {
    if (!isColumnValid(f.columnName)) continue;
    const col = quote(f.columnName);
    const op = sanitizeOperator(f.operator);

    if (dialect === 'postgres') {
      if (op === 'BETWEEN' && f.value2 != null) {
        whereConditions.push(
          `${col} BETWEEN $${pgParams.length + 1} AND $${pgParams.length + 2}`
        );
        pgParams.push(f.value as QueryParam, f.value2 as QueryParam);
      } else {
        whereConditions.push(`${col} ${op} $${pgParams.length + 1}`);
        pgParams.push(f.value as QueryParam);
      }
    } else {
      if (op === 'BETWEEN' && f.value2 != null) {
        whereConditions.push(
          `${col} BETWEEN ${escapeDuckDBValue(f.value)} AND ${escapeDuckDBValue(f.value2)}`
        );
      } else {
        whereConditions.push(`${col} ${op} ${escapeDuckDBValue(f.value)}`);
      }
    }
  }

  // ───────────────────────────────────────────────────────────
  // SELECT expressions (base CTE)
  // ───────────────────────────────────────────────────────────
  for (const cfg of dashboardGroupsConfig) {
    if (!cfg.enabled) continue;
    const groupDef = groups.find((g) => g.id === cfg.groupId);
    if (!groupDef) continue;

    for (const metric of groupDef.metrics) {
      if (!metric.enabled) continue;
      const tpl = metricTemplates.find((t) => t.id === metric.templateId);
      if (!tpl) continue;

      const finalAlias = `${cfg.groupId}__${metric.id}`;
      const baseAlias = `base_${finalAlias}`;

      // ═══════════════════════════════════════════════════════
      // AGGREGATE метрика
      // ═══════════════════════════════════════════════════════
      if (tpl.type === 'aggregate' && tpl.aggregateFunction && tpl.aggregateField) {
        const binding = metric.fieldBindings.find(
          (b) => b.fieldAlias === tpl.aggregateField
        );
        if (!binding) continue;
        const fn = tpl.aggregateFunction.toUpperCase();

        if (!isColumnValid(binding.columnName)) {
          baseSelectParts.push(`NULL AS ${quote(finalAlias)}`);
          aggregateMetadata.set(finalAlias, { aggregateFunction: tpl.aggregateFunction });
          if (fn === 'AVG') {
            baseSelectParts.push(`NULL AS ${quote(`__agg_sum__${finalAlias}`)}`);
            baseSelectParts.push(`NULL AS ${quote(`__agg_count__${finalAlias}`)}`);
          }
          continue;
        }

        const expr = buildAggregateExpr(binding.columnName, fn, dialect);
        baseSelectParts.push(`${expr} AS ${quote(finalAlias)}`);
        aggregateMetadata.set(finalAlias, { aggregateFunction: tpl.aggregateFunction });

        if (fn === 'AVG') {
          const castedCol = castToNumeric(quote(binding.columnName), dialect);
          baseSelectParts.push(
            `SUM(${castedCol}) AS ${quote(`__agg_sum__${finalAlias}`)}`
          );
          baseSelectParts.push(
            `COUNT(${quote(binding.columnName)}) AS ${quote(`__agg_count__${finalAlias}`)}`
          );
        }
        continue;
      }

      // ═══════════════════════════════════════════════════════
      // CALCULATED метрика
      // ═══════════════════════════════════════════════════════
      if (tpl.type === 'calculated' && tpl.formula) {
        const fieldDependencies: CompiledFormulaMeta['fieldDependencies'] = [];

        for (const fb of metric.fieldBindings) {
          const depBaseAlias = `${FIELD_DEP_PREFIX}${cfg.groupId}_${metric.id}_${fb.fieldAlias}`;
          const aggregateFn = 'SUM';

          if (!isColumnValid(fb.columnName)) {
            baseSelectParts.push(`NULL AS ${quote(depBaseAlias)}`);
          } else {
            const expr = buildAggregateExpr(fb.columnName, aggregateFn, dialect);
            baseSelectParts.push(`${expr} AS ${quote(depBaseAlias)}`);
          }

          fieldDependencies.push({
            alias: fb.fieldAlias,
            columnName: fb.columnName,
            aggregateFn,
          });
        }

        const metricDependencies: CompiledFormulaMeta['metricDependencies'] =
          metric.metricBindings.map((mb) => ({
            alias: mb.metricAlias,
            metricId: mb.metricId,
          }));

        // Сохраняем метаданные (для fallback и пост-обработки)
        formulas.set(baseAlias, {
          groupId: cfg.groupId,
          metricId: metric.id,
          templateId: tpl.id,
          formula: tpl.formula,
          fieldDependencies,
          metricDependencies,
        });

        calculatedMetrics.push({
          baseAlias,
          finalAlias,
          formula: tpl.formula,
          groupId: cfg.groupId,
          metricId: metric.id,
          templateId: tpl.id,
          fieldDependencies,
          metricDependencies,
        });
      }
    }
  }

  // ───────────────────────────────────────────────────────────
  // Topological sort calculated метрик
  // ───────────────────────────────────────────────────────────
  const sortedCalculated = topologicalSortCalculated(calculatedMetrics);

  // ───────────────────────────────────────────────────────────
  // Компиляция calculated-метрик в SQL через CTE
  // ───────────────────────────────────────────────────────────
  const cteParts: string[] = [];
  const calcSelectParts: string[][] = [];

  // Маппинг alias → SQL-выражение (для компилятора формул)
  const fieldAliasMap = new Map<string, string>();
  const metricAliasMap = new Map<string, string>();

  // Заполняем field aliases для КАЖДОЙ calculated метрики
  for (const calc of sortedCalculated) {
    for (const fd of calc.fieldDependencies) {
      const depAlias = `${FIELD_DEP_PREFIX}${calc.groupId}_${calc.metricId}_${fd.alias}`;
      fieldAliasMap.set(fd.alias, wrapWithCoalesce(quote(depAlias)));
    }
  }

  // Пытаемся скомпилировать каждую calculated метрику
  let allCalculatedCompiled = true;

  for (const calc of sortedCalculated) {
    // Для МЕТРИЧЕСКИХ зависимостей используем finalAlias предыдущих CTE
    const localMetricAliases = new Map<string, string>();
    for (const md of calc.metricDependencies) {
      // Ищем finalAlias по metricId
      const depCalc = sortedCalculated.find((c) => c.metricId === md.metricId);
      if (depCalc) {
        localMetricAliases.set(
          md.alias,
          wrapWithCoalesce(quote(depCalc.finalAlias))
        );
      } else {
        // Зависимость от aggregate-метрики — ищем в formulas
        // Aggregate метрики имеют finalAlias напрямую в base CTE
        const aggAlias = calc.groupId.includes(md.metricId)
          ? md.metricId
          : undefined;
        if (aggAlias) {
          localMetricAliases.set(md.alias, wrapWithCoalesce(quote(aggAlias)));
        }
      }
    }

    const ctx = createFormulaToSqlContext(
      fieldAliasMap,
      localMetricAliases,
      dialect
    );
    const compiler = new FormulaToSqlCompiler(ctx);
    const result = compiler.compile(calc.formula);

    if (!result.success) {
      console.warn(
        `[query-compiler] ⚠️ Cannot compile formula for "${calc.finalAlias}" to SQL: ${result.reason}. ` +
          `Falling back ALL calculated metrics to Math.js.`
      );
      allCalculatedCompiled = false;
      break;
    }

    calcSelectParts.push([
      `${result.sql} AS ${quote(calc.finalAlias)}`,
      calc.baseAlias,
    ]);
  }

  // ───────────────────────────────────────────────────────────
  // Сборка финального SQL
  // ───────────────────────────────────────────────────────────
  let sql: string;

  if (allCalculatedCompiled && sortedCalculated.length > 0) {
    // ✅ Успех: используем CTE
    const baseSql = [
      `SELECT ${baseSelectParts.join(', ')}`,
      `FROM ${tableName}`,
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '',
      safeGroupByColumn ? `GROUP BY ${quote(safeGroupByColumn)}` : '',
    ]
      .filter(Boolean)
      .join(' ');

    cteParts.push(`${BASE_CTE_NAME} AS (${baseSql})`);

    let previousCteName = BASE_CTE_NAME;
    const accumulatedSelectParts = [...baseSelectParts];

    for (let i = 0; i < sortedCalculated.length; i++) {
      const [calcExpr, baseAlias] = calcSelectParts[i];
      const cteName = `${CALC_CTE_PREFIX}${sortedCalculated[i].finalAlias.replace(/[^a-zA-Z0-9_]/g, '_')}`;

      // В текущем CTE выбираем всё из предыдущего + новая calculated метрика
      // Исключаем из SELECT технические field deps, которые не нужны далее
      const currentSelectParts = accumulatedSelectParts.filter((part) => {
        // Убираем base_* алиасы — они не нужны в финальном результате
        if (/AS\s+"base_/.test(part)) return false;
        return true;
      });
      currentSelectParts.push(calcExpr);

      const cteSql = `SELECT ${currentSelectParts.join(', ')} FROM ${previousCteName}`;
      cteParts.push(`${cteName} AS (${cteSql})`);

      accumulatedSelectParts.push(calcExpr);
      previousCteName = cteName;

      // Помечаем как вычисленную в SQL
      calculatedInSqlAliases.add(sortedCalculated[i].finalAlias);
    }

    // ORDER BY и LIMIT применяются к финальному CTE
    let orderByClause = '';
    let limitClause = '';
    if (safeGroupByColumn) {
      const firstMetricAlias = baseSelectParts.find(
        (p) =>
          p.includes('__') &&
          !p.includes('_record_count') &&
          !p.startsWith('NULL') &&
          !p.includes(FIELD_DEP_PREFIX)
      );
      if (firstMetricAlias) {
        const match = firstMetricAlias.match(/AS\s+"([^"]+)"/);
        if (match) {
          orderByClause = `ORDER BY ${quote(match[1])} DESC`;
        }
      }
      limitClause = 'LIMIT 1000';
    }

    const finalParts = [
      `WITH ${cteParts.join(', ')}`,
      `SELECT * FROM ${previousCteName}`,
      orderByClause,
      limitClause,
    ].filter(Boolean);

    sql = finalParts.join(' ');
  } else {
    // ❌ Fallback: старый подход (все calculated через Math.js)
    // Добавляем field deps в SELECT для пост-обработки
    for (const calc of sortedCalculated) {
      for (const fd of calc.fieldDependencies) {
        const depAlias = `${calc.baseAlias}__${fd.alias}`;
        if (!isColumnValid(fd.columnName)) {
          baseSelectParts.push(`NULL AS ${quote(depAlias)}`);
        } else {
          const expr = buildAggregateExpr(fd.columnName, fd.aggregateFn, dialect);
          baseSelectParts.push(`${expr} AS ${quote(depAlias)}`);
        }
      }
    }

    let orderByClause = '';
    let limitClause = '';
    if (safeGroupByColumn) {
      const firstMetricAlias = baseSelectParts.find(
        (p) =>
          p.includes('__') &&
          !p.includes('_record_count') &&
          !p.startsWith('NULL') &&
          !p.includes(FIELD_DEP_PREFIX)
      );
      if (firstMetricAlias) {
        const match = firstMetricAlias.match(/AS\s+"([^"]+)"/);
        if (match) orderByClause = `ORDER BY ${quote(match[1])} DESC`;
      }
      limitClause = 'LIMIT 1000';
    }

    sql = [
      `SELECT ${baseSelectParts.join(', ')}`,
      `FROM ${tableName}`,
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '',
      safeGroupByColumn ? `GROUP BY ${quote(safeGroupByColumn)}` : '',
      orderByClause,
      limitClause,
    ]
      .filter(Boolean)
      .join(' ');
  }

  return {
    sql,
    params: dialect === 'postgres' ? pgParams : undefined,
    formulas,
    aggregateMetadata,
    calculatedInSqlAliases,
  };
}