import { logger } from '@/shared/lib/logger';
import type {
  ComputeDialect,
  CompiledQuery,
  CompiledFormulaMeta,
  QueryParam,
  ClientComputeParams,
  MetricAggregationMeta,
  DateGranularity,
} from './types';
import {
  FormulaToSqlCompiler,
  createFormulaToSqlContext,
  wrapWithCoalesce,
} from './formula-to-sql';
import { quoteIdent as quote } from './sql-utils';
import {
  preprocessAggregateFormula,
  DEFAULT_AGGREGATE_OPTIONS,
} from './aggregate-formula';

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
    logger.warn(`[query-compiler] Blocked invalid operator: ${op}`);
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
  logger.warn(`[query-compiler] Unexpected value type: ${typeof val}`);
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
// Временна́я группировка (groupByDateGranularity)
//
// Значение размерности уходит в SQL внутри date_trunc('<g>', …) —
// поэтому строго whitelist'ится; формат метки фиксирован на размерность,
// чтобы текстовая сортировка ASC совпадала с хронологической.
// ─────────────────────────────────────────────────────────────
const DATE_GRANULARITIES = new Set<DateGranularity>([
  'minute', 'hour', 'day', 'week', 'month', 'year',
]);

const DUCKDB_DATE_LABEL_FORMATS: Record<DateGranularity, string> = {
  minute: '%Y-%m-%d %H:%M',
  hour: '%Y-%m-%d %H:00',
  day: '%Y-%m-%d',
  week: '%Y-%m-%d',
  month: '%Y-%m',
  year: '%Y',
};

const PG_DATE_LABEL_FORMATS: Record<DateGranularity, string> = {
  minute: 'YYYY-MM-DD HH24:MI',
  hour: 'YYYY-MM-DD HH24:00',
  day: 'YYYY-MM-DD',
  week: 'YYYY-MM-DD',
  month: 'YYYY-MM',
  year: 'YYYY',
};

/**
 * Выражение метки временно́й группы: date_trunc по размерности,
 * отформатированный в строку. Для DuckDB колонка приводится через
 * TRY_CAST (невалидные значения дают NULL и отфильтровываются
 * по пустой метке на стороне потребителя breakdown).
 */
function buildDateLabelExpr(
  columnName: string,
  granularity: DateGranularity,
  dialect: ComputeDialect
): string {
  const col = quote(columnName);
  if (dialect === 'duckdb') {
    return `strftime(date_trunc('${granularity}', TRY_CAST(${col} AS TIMESTAMP)), '${DUCKDB_DATE_LABEL_FORMATS[granularity]}')`;
  }
  return `to_char(date_trunc('${granularity}', ${col}::timestamp), '${PG_DATE_LABEL_FORMATS[granularity]}')`;
}

// ─────────────────────────────────────────────────────────────
// Лимит строк breakdown при группировке.
//
// SQL запрашивает BREAKDOWN_LIMIT + 1 строк: лишняя строка — сигнал
// потребителю (worker / pg-engine), что данные усечены. Потребитель
// обязан обрезать массив до BREAKDOWN_LIMIT и выставить
// breakdownTruncated в результате — иначе пользователь увидит
// неполную таблицу без индикатора (п.1 аудита ядра).
// ─────────────────────────────────────────────────────────────
export const BREAKDOWN_LIMIT = 1000;

// ─────────────────────────────────────────────────────────────
// Префиксы для технических алиасов
// ─────────────────────────────────────────────────────────────
export const FIELD_DEP_PREFIX = '_fb';
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
      logger.warn(
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

/**
 * Компилирует параметры дашборда в SQL-запрос (DuckDB или PostgreSQL).
 *
 * Безопасность:
 * - для `postgres` список `validColumns` ОБЯЗАТЕЛЕН (whitelist колонок
 *   с сервера из information_schema) — без него запрос не компилируется;
 * - для `duckdb` (in-browser БД) whitelist опционален: при отсутствии
 *   колонки доверяются, при наличии — фильтруются;
 * - значения фильтров для PG уходят позиционными параметрами `$n`,
 *   для DuckDB — экранируются инлайн;
 * - все идентификаторы экранируются через quoteIdent.
 */
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
    groupByDateColumn,
    groupByDateGranularity,
    validColumns,
  } = params;

  // Дефолтный авто-агрегат и режим «требовать явный агрегат» (из настроек).
  const formulaOptions = params.formulaOptions ?? DEFAULT_AGGREGATE_OPTIONS;

  if (dialect === 'postgres' && !validColumns) {
    throw new Error(
      '[query-compiler] validColumns обязателен для PostgreSQL: ' +
        'whitelist колонок должен приходить с сервера (information_schema)'
    );
  }

  const isColumnValid = (colName: string): boolean =>
    !validColumns || validColumns.includes(colName);

  const formulas = new Map<string, CompiledFormulaMeta>();
  const aggregateMetadata = new Map<string, MetricAggregationMeta>();
  const calculatedInSqlAliases = new Set<string>();
  // finalAlias всех прямо-эмитнутых (fast-path) метрик: SUM/AVG/… по колонке.
  // Их значение лежит в base-CTE под этим алиасом и проносится в calc-CTE, но в
  // `formulas` их нет (fast-path делает continue), поэтому metric-зависимость
  // расчётной метрики на них иначе не резолвится в SQL (Unresolved symbol).
  const emittedMetricFinalAliases = new Set<string>();

  const baseSelectParts: string[] = [];

  // Эмитит агрегат (метрики или field-зависимости) в base-CTE: само значение
  // + для AVG помощники взвешенного «Итого» (Σsum/Σcount — иначе среднее
  // средних исказит сводку). Невалидная колонка → NULL во все части.
  const emitAggregateSelect = (columnName: string, aggregateFn: string, alias: string): void => {
    const fn = aggregateFn.toUpperCase();
    if (!isColumnValid(columnName)) {
      baseSelectParts.push(`NULL AS ${quote(alias)}`);
      if (fn === 'AVG') {
        baseSelectParts.push(`NULL AS ${quote(`__agg_sum__${alias}`)}`);
        baseSelectParts.push(`NULL AS ${quote(`__agg_count__${alias}`)}`);
      }
      return;
    }
    baseSelectParts.push(`${buildAggregateExpr(columnName, fn, dialect)} AS ${quote(alias)}`);
    if (fn === 'AVG') {
      const castedCol = castToNumeric(quote(columnName), dialect);
      baseSelectParts.push(`SUM(${castedCol}) AS ${quote(`__agg_sum__${alias}`)}`);
      baseSelectParts.push(`COUNT(${quote(columnName)}) AS ${quote(`__agg_count__${alias}`)}`);
    }
  };
  const pgParams: QueryParam[] = [];
  const whereConditions: string[] = [];
  const calculatedMetrics: CalculatedMetricEntry[] = [];

  // ── Измерения группировки ──────────────────────────────────
  // Категориальное (groupByColumn) и временно́е (groupByDateColumn +
  // granularity) измерения независимы:
  //  - только категория → _group_label = колонка (как раньше);
  //  - только дата     → _group_label = date_trunc-метка (1-D путь
  //    потребителей сохраняется);
  //  - оба             → двумерная группировка: _group_label = категория,
  //    _date_label = date_trunc-метка.
  let safeGroupByColumn: string | undefined;
  // Выражения для GROUP BY (по числу активных измерений)
  const groupByExprs: string[] = [];
  // true — сортировать breakdown хронологически, а не по первой метрике
  let orderByDateLabel = false;
  // true — в SELECT есть отдельная колонка _date_label (двумерный режим)
  let hasDateLabelColumn = false;

  let dateExpr: string | undefined;
  if (groupByDateColumn && isColumnValid(groupByDateColumn)) {
    if (groupByDateGranularity && DATE_GRANULARITIES.has(groupByDateGranularity)) {
      dateExpr = buildDateLabelExpr(groupByDateColumn, groupByDateGranularity, dialect);
    } else {
      logger.warn(
        `[query-compiler] Blocked invalid date granularity: ${groupByDateGranularity}`
      );
    }
  }

  if (groupByColumn && isColumnValid(groupByColumn)) {
    safeGroupByColumn = groupByColumn;
    const labelExpr = quote(groupByColumn);
    groupByExprs.push(labelExpr);
    baseSelectParts.push(`${labelExpr} AS "_group_label"`);

    if (dateExpr) {
      // Двумерный режим: время — вторая колонка метки
      groupByExprs.push(dateExpr);
      baseSelectParts.push(`${dateExpr} AS "_date_label"`);
      hasDateLabelColumn = true;
      orderByDateLabel = true;
    }
  } else if (dateExpr) {
    // Только время: метка группы — временно́й интервал
    safeGroupByColumn = groupByDateColumn;
    groupByExprs.push(dateExpr);
    baseSelectParts.push(`${dateExpr} AS "_group_label"`);
    orderByDateLabel = true;
  } else if (groupByColumn) {
    // Категориальная колонка не прошла whitelist
    baseSelectParts.push(`NULL AS "_group_label"`);
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
  // Индексы id→объект: линейный .find() во вложенном цикле давал
  // O(групп × метрик × шаблонов); на 100+ метрик/шаблонов заметно (№15).
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const templateById = new Map(metricTemplates.map((t) => [t.id, t]));

  for (const cfg of dashboardGroupsConfig) {
    if (!cfg.enabled) continue;
    const groupDef = groupById.get(cfg.groupId);
    if (!groupDef) continue;

    for (const metric of groupDef.metrics) {
      if (!metric.enabled) continue;
      const tpl = templateById.get(metric.templateId);
      if (!tpl) continue;

      const finalAlias = `${cfg.groupId}__${metric.id}`;
      const baseAlias = `base_${finalAlias}`;

      // ═══════════════════════════════════════════════════════
      // МЕТРИКА = ФОРМУЛА (агрегаты задаются функциями: MAX(a)/SUM(b)).
      // Препроцессор превращает агрегаты в зависимости и переписывает
      // формулу на пред-агрегированные псевдо-переменные. Голая колонка
      // авто-оборачивается в дефолтный агрегат (или запрещается).
      // ═══════════════════════════════════════════════════════
      if (tpl.formula) {
        const fieldBindingMap = new Map(
          metric.fieldBindings.map((fb) => [fb.fieldAlias, fb.columnName])
        );
        const metricAliasSet = new Set(
          metric.metricBindings.map((mb) => mb.metricAlias)
        );
        // Расчётная метрика (формула над операндами-показателями: метрики и/или
        // несколько полей) задаёт агрегат неявно — операнды пишутся голыми
        // (`a/b`), а не `SUM(a)/SUM(b)` (UI операндов не даёт писать функцию).
        // Для неё голую колонку авто-оборачиваем в дефолтный агрегат, даже если
        // глобально включён requireExplicit (он для вручную набранных формул).
        const isCalculated =
          metric.metricBindings.length > 0 || metric.fieldBindings.length > 1;
        const pre = preprocessAggregateFormula(
          tpl.formula,
          fieldBindingMap,
          metricAliasSet,
          isCalculated ? { ...formulaOptions, requireExplicit: false } : formulaOptions
        );
        if (!pre.success) {
          logger.warn(
            `[query-compiler] Метрика ${metric.id}: формула не скомпилирована — ${pre.error}`
          );
          continue;
        }

        // Fast-path: формула — единственный агрегат над колонкой (FN(field)).
        // Эмитим прямой агрегат как метрику-значение (без CTE), сохраняя
        // SQL-форму, aggregateMetadata и точное взвешенное «Итого» для AVG.
        if (
          pre.fieldDependencies.length === 1 &&
          metric.metricBindings.length === 0 &&
          pre.formula.trim() === pre.fieldDependencies[0].alias
        ) {
          const fd = pre.fieldDependencies[0];
          const fn = fd.aggregateFn.toUpperCase();
          aggregateMetadata.set(finalAlias, {
            aggregateFunction: fd.aggregateFn as MetricAggregationMeta['aggregateFunction'],
          });

          emitAggregateSelect(fd.columnName, fn, finalAlias);
          emittedMetricFinalAliases.add(finalAlias);
          continue;
        }

        const fieldDependencies = pre.fieldDependencies;
        for (const fd of fieldDependencies) {
          const depBaseAlias = `${FIELD_DEP_PREFIX}${cfg.groupId}_${metric.id}_${fd.alias}`;
          emitAggregateSelect(fd.columnName, fd.aggregateFn, depBaseAlias);
        }

        const metricDependencies: CompiledFormulaMeta['metricDependencies'] =
          metric.metricBindings.map((mb) => ({
            alias: mb.metricAlias,
            metricId: mb.metricId,
          }));

        // Сохраняем метаданные (для fallback и пост-обработки).
        // formula — ПЕРЕПИСАННАЯ (на пред-агрегированные псевдо-переменные),
        // её же считает и mathjs-fallback в post-process.
        formulas.set(baseAlias, {
          groupId: cfg.groupId,
          metricId: metric.id,
          templateId: tpl.id,
          formula: pre.formula,
          fieldDependencies,
          metricDependencies,
        });

        calculatedMetrics.push({
          baseAlias,
          finalAlias,
          formula: pre.formula,
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
  let allCalculatedCompiled = true;
  for (const calc of sortedCalculated) {
      // ─── Локальные field aliases ТОЛЬКО для текущей метрики ───
      const localFieldAliases = new Map<string, string>();
      for (const fd of calc.fieldDependencies) {
          const depAlias = `${FIELD_DEP_PREFIX}${calc.groupId}_${calc.metricId}_${fd.alias}`;
          localFieldAliases.set(fd.alias, wrapWithCoalesce(quote(depAlias)));
      }

      // ─── Локальные metric aliases для зависимостей от других метрик ───
      const localMetricAliases = new Map<string, string>();
      for (const md of calc.metricDependencies) {
          const depCalc = sortedCalculated.find((c) => c.metricId === md.metricId);
          if (depCalc) {
              localMetricAliases.set(
                  md.alias,
                  wrapWithCoalesce(quote(depCalc.finalAlias))
              );
          } else {
              // Зависимость от формульной (через CTE) метрики — ищем в formulas.
              const aggMeta = Array.from(formulas.values()).find(
                  (f) => f.metricId === md.metricId && f.groupId === calc.groupId
              );
              const aggFinalAlias = `${calc.groupId}__${md.metricId}`;
              if (aggMeta) {
                  localMetricAliases.set(md.alias, wrapWithCoalesce(quote(aggFinalAlias)));
              } else if (emittedMetricFinalAliases.has(aggFinalAlias)) {
                  // Зависимость от fast-path метрики (SUM/AVG по колонке): её
                  // значение проносится в calc-CTE под finalAlias. Иначе алиас
                  // остался бы неразрешённым → срыв всей SQL-компиляции.
                  localMetricAliases.set(md.alias, wrapWithCoalesce(quote(aggFinalAlias)));
              }
          }
      }

      // ─── Контекст содержит ТОЛЬКО зависимости текущей метрики ───
      const ctx = createFormulaToSqlContext(
          localFieldAliases,   // ← field deps ТОЛЬКО этой метрики
          localMetricAliases,  // ← metric deps ТОЛЬКО этой метрики
          dialect
      );
      const compiler = new FormulaToSqlCompiler(ctx);
      const result = compiler.compile(calc.formula);

      if (!result.success) {
          logger.warn(
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
    const baseSql = [
      `SELECT ${baseSelectParts.join(', ')}`,
      `FROM ${tableName}`,
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '',
      groupByExprs.length > 0 ? `GROUP BY ${groupByExprs.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join(' ');
    cteParts.push(`${BASE_CTE_NAME} AS (${baseSql})`);
    
    const extractAlias = (expr: string): string | null => {
      const match = expr.match(/AS\s+"([^"]+)"/);
      return match ? match[1] : null;
    };

    const availableAliases: string[] = [];
    for (const part of baseSelectParts) {
      const alias = extractAlias(part);
      if (alias) availableAliases.push(alias);
    }

    let previousCteName = BASE_CTE_NAME;

    for (let i = 0; i < sortedCalculated.length; i++) {
      const [calcExpr] = calcSelectParts[i];
      const cteName = `${CALC_CTE_PREFIX}${sortedCalculated[i].finalAlias.replace(/[^a-zA-Z0-9_]/g, '_')}`;

      const currentSelectParts = availableAliases
        .filter(alias => !alias.startsWith('base_'))
        .map(alias => quote(alias));
      currentSelectParts.push(calcExpr);

      const cteSql = `SELECT ${currentSelectParts.join(', ')} FROM ${previousCteName}`;
      cteParts.push(`${cteName} AS (${cteSql})`);

      const newAlias = extractAlias(calcExpr);
      if (newAlias) availableAliases.push(newAlias);

      previousCteName = cteName;
      calculatedInSqlAliases.add(sortedCalculated[i].finalAlias);
    }

    // ORDER BY и LIMIT
    let orderByClause = '';
    let limitClause = '';
    if (safeGroupByColumn) {
      if (hasDateLabelColumn) {
        // Двумерный режим: хронология, внутри интервала — по категории
        orderByClause = `ORDER BY "_date_label" ASC, "_group_label" ASC`;
      } else if (orderByDateLabel) {
        // Временна́я группировка — хронологический порядок по метке
        orderByClause = `ORDER BY "_group_label" ASC`;
      } else {
        const firstMetricAlias = availableAliases.find(
          (a) =>
            a.includes('__') &&
            a !== '_group_label' &&
            a !== '_record_count' &&
            !a.startsWith('base_') &&
            !a.startsWith('__fb_') &&
            !a.startsWith('__agg_')
        );
        if (firstMetricAlias) {
          orderByClause = `ORDER BY ${quote(firstMetricAlias)} DESC`;
        }
      }
      limitClause = `LIMIT ${BREAKDOWN_LIMIT + 1}`;
    }

    const finalParts = [
      `WITH ${cteParts.join(', ')}`,
      `SELECT * FROM ${previousCteName}`,
      orderByClause,
      limitClause,
    ].filter(Boolean);

    sql = finalParts.join(' ');
  } else {
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
      if (hasDateLabelColumn) {
        orderByClause = `ORDER BY "_date_label" ASC, "_group_label" ASC`;
      } else if (orderByDateLabel) {
        orderByClause = `ORDER BY "_group_label" ASC`;
      } else {
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
      }
      limitClause = `LIMIT ${BREAKDOWN_LIMIT + 1}`;
    }

    sql = [
      `SELECT ${baseSelectParts.join(', ')}`,
      `FROM ${tableName}`,
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '',
      groupByExprs.length > 0 ? `GROUP BY ${groupByExprs.join(', ')}` : '',
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