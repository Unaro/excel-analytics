import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { compileQuery, BREAKDOWN_LIMIT } from './query-compiler';
import {
  makeParams,
  makeFilter,
  makeGroup,
  makeGroupMetric,
  makeAggregateTemplate,
  makeCalculatedTemplate,
  makeGroupConfig,
} from './test-fixtures';

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

/**
 * Параметры для PostgreSQL-диалекта: validColumns обязателен
 * (серверный whitelist из information_schema — Phase 2 security).
 */
const makePgParams = (over: Parameters<typeof makeParams>[0] = {}) =>
  makeParams({ validColumns: ['revenue', 'region'], ...over });

describe('compileQuery: aggregate-метрики', () => {
  it('DuckDB: SUM с TRY_CAST и алиасом groupId__metricId', () => {
    const { sql, params } = compileQuery(makeParams(), 'duckdb');

    expect(sql).toContain('SUM(TRY_CAST("revenue" AS DOUBLE)) AS "g1__m1"');
    expect(sql).toContain('FROM "dt_ds1"');
    expect(sql).toContain('COUNT(*) AS "_record_count"');
    expect(sql).not.toContain('WHERE');
    expect(params).toBeUndefined();
  });

  it('PostgreSQL: каст через NULLIF(...)::DOUBLE PRECISION', () => {
    const { sql, params } = compileQuery(makePgParams(), 'postgres');

    expect(sql).toContain('SUM(NULLIF("revenue", \'\')::DOUBLE PRECISION) AS "g1__m1"');
    expect(params).toEqual([]);
  });

  it('AVG добавляет служебные __agg_sum__/__agg_count__ для переагрегации', () => {
    const params = makeParams({
      metricTemplates: [makeAggregateTemplate({ aggregateFunction: 'AVG' })],
    });
    const { sql } = compileQuery(params, 'duckdb');

    expect(sql).toContain('AS "__agg_sum__g1__m1"');
    expect(sql).toContain('AS "__agg_count__g1__m1"');
  });

  it('COUNT не кастует колонку к числу', () => {
    const params = makeParams({
      metricTemplates: [makeAggregateTemplate({ aggregateFunction: 'COUNT' })],
    });
    const { sql } = compileQuery(params, 'duckdb');

    expect(sql).toContain('COUNT("revenue") AS "g1__m1"');
  });

  it('MEDIAN: MEDIAN() в DuckDB, PERCENTILE_CONT в PostgreSQL', () => {
    const tpl = [makeAggregateTemplate({ aggregateFunction: 'MEDIAN' })];

    expect(
      compileQuery(makeParams({ metricTemplates: tpl }), 'duckdb').sql
    ).toContain('MEDIAN(');
    expect(
      compileQuery(makePgParams({ metricTemplates: tpl }), 'postgres').sql
    ).toContain('PERCENTILE_CONT(0.5) WITHIN GROUP');
  });

  it('отключённые метрики и группы не попадают в SQL', () => {
    const params = makeParams({
      groups: [makeGroup({ metrics: [makeGroupMetric({ enabled: false })] })],
    });
    const { sql } = compileQuery(params, 'duckdb');

    expect(sql).not.toContain('g1__m1');
  });
});

describe('compileQuery: фильтры WHERE', () => {
  it('PostgreSQL: значения только через позиционные параметры $n', () => {
    const params = makePgParams({
      filters: [makeFilter({ value: 'Москва' })],
    });
    const { sql, params: queryParams } = compileQuery(params, 'postgres');

    expect(sql).toContain('"region" = $1');
    expect(sql).not.toContain('Москва');
    expect(queryParams).toEqual(['Москва']);
  });

  it('PostgreSQL: BETWEEN использует два параметра', () => {
    const params = makePgParams({
      filters: [makeFilter({ operator: 'between', value: '10', value2: '20' })],
    });
    const { sql, params: queryParams } = compileQuery(params, 'postgres');

    expect(sql).toContain('"region" BETWEEN $1 AND $2');
    expect(queryParams).toEqual(['10', '20']);
  });

  it('DuckDB: строковые значения экранируются инлайн (кавычки удваиваются)', () => {
    const params = makeParams({
      filters: [makeFilter({ value: "O'Hara" })],
    });
    const { sql } = compileQuery(params, 'duckdb');

    expect(sql).toContain(`"region" = 'O''Hara'`);
  });

  it('недопустимый оператор блокируется и заменяется на =', () => {
    const params = makeParams({
      filters: [
        makeFilter({
          // Закрываем enum «снаружи»: оператор приходит из клиентских данных
          operator: 'OR 1=1; --' as never,
          value: 'x',
        }),
      ],
    });
    const { sql } = compileQuery(params, 'duckdb');

    expect(sql).toContain(`"region" = 'x'`);
    expect(sql).not.toContain('OR 1=1');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('фильтр по колонке вне validColumns отбрасывается', () => {
    const params = makeParams({
      validColumns: ['revenue'],
      filters: [makeFilter({ columnName: 'hacked' })],
    });
    const { sql } = compileQuery(params, 'postgres');

    expect(sql).not.toContain('hacked');
  });
});

describe('compileQuery: валидация колонок и идентификаторов', () => {
  // Phase 2 security: для PostgreSQL validColumns обязателен (whitelist
  // приходит с сервера из information_schema, клиентский игнорируется —
  // см. server-actions/pg-compute.ts). Для DuckDB (in-browser БД)
  // сохранено мягкое поведение: без validColumns колонки доверяются.
  it('PostgreSQL без validColumns → ошибка компиляции', () => {
    expect(() =>
      compileQuery(makeParams({ validColumns: undefined }), 'postgres')
    ).toThrow(/validColumns обязателен/);
  });

  it('DuckDB без validColumns доверяет колонкам (in-browser БД)', () => {
    const params = makeParams({
      validColumns: undefined,
      filters: [makeFilter({ columnName: 'anything"goes' })],
    });
    const { sql } = compileQuery(params, 'duckdb');

    // Кавычки в идентификаторе экранируются, но колонка не отбрасывается
    expect(sql).toContain('"anything""goes"');
  });

  it('DuckDB: tableName интерполируется как есть (формируется кодом, не пользователем)', () => {
    const params = makeParams({ tableName: 'evil_table; DROP TABLE users' });
    const { sql } = compileQuery(params, 'duckdb');

    // Для PG тот же вектор закрыт на сервере: tableName строится из
    // information_schema через qualifiedTableName.
    expect(sql).toContain('FROM evil_table; DROP TABLE users');
  });

  it('aggregate-метрика по невалидной колонке деградирует в NULL', () => {
    const params = makeParams({ validColumns: ['other_column'] });
    const { sql } = compileQuery(params, 'duckdb');

    expect(sql).toContain('NULL AS "g1__m1"');
    expect(sql).not.toContain('SUM');
  });
});

describe('compileQuery: группировка', () => {
  it('валидный groupByColumn добавляет _group_label, GROUP BY, ORDER BY и LIMIT', () => {
    const params = makeParams({
      groupByColumn: 'region',
      validColumns: ['region', 'revenue'],
    });
    const { sql } = compileQuery(params, 'duckdb');

    expect(sql).toContain('"region" AS "_group_label"');
    expect(sql).toContain('GROUP BY "region"');
    expect(sql).toContain('ORDER BY "g1__m1" DESC');
    // BREAKDOWN_LIMIT + 1: лишняя строка — сигнал усечения потребителю
    expect(sql).toContain(`LIMIT ${BREAKDOWN_LIMIT + 1}`);
  });

  it('только дата (groupByDateColumn): date_trunc-метка как _group_label, хронологический ORDER BY', () => {
    const params = makeParams({
      groupByDateColumn: 'created_at',
      groupByDateGranularity: 'month',
      validColumns: ['created_at', 'revenue'],
    });

    const duck = compileQuery(params, 'duckdb');
    expect(duck.sql).toContain(
      `strftime(date_trunc('month', TRY_CAST("created_at" AS TIMESTAMP)), '%Y-%m') AS "_group_label"`
    );
    expect(duck.sql).toContain(
      `GROUP BY strftime(date_trunc('month', TRY_CAST("created_at" AS TIMESTAMP)), '%Y-%m')`
    );
    expect(duck.sql).toContain('ORDER BY "_group_label" ASC');
    expect(duck.sql).toContain(`LIMIT ${BREAKDOWN_LIMIT + 1}`);
    expect(duck.sql).not.toContain('_date_label');

    const pg = compileQuery(params, 'postgres');
    expect(pg.sql).toContain(
      `to_char(date_trunc('month', "created_at"::timestamp), 'YYYY-MM') AS "_group_label"`
    );
    expect(pg.sql).toContain('ORDER BY "_group_label" ASC');
  });

  it('двумерная группировка: категория = _group_label, время = _date_label, GROUP BY оба', () => {
    const params = makeParams({
      groupByColumn: 'region',
      groupByDateColumn: 'created_at',
      groupByDateGranularity: 'day',
      validColumns: ['region', 'created_at', 'revenue'],
    });

    const { sql } = compileQuery(params, 'duckdb');
    expect(sql).toContain(`"region" AS "_group_label"`);
    expect(sql).toContain(
      `strftime(date_trunc('day', TRY_CAST("created_at" AS TIMESTAMP)), '%Y-%m-%d') AS "_date_label"`
    );
    expect(sql).toContain(
      `GROUP BY "region", strftime(date_trunc('day', TRY_CAST("created_at" AS TIMESTAMP)), '%Y-%m-%d')`
    );
    expect(sql).toContain('ORDER BY "_date_label" ASC, "_group_label" ASC');
    expect(sql).toContain(`LIMIT ${BREAKDOWN_LIMIT + 1}`);
  });

  it('невалидная размерность даты отбрасывается — группировка только по категории', () => {
    const params = makeParams({
      groupByColumn: 'region',
      groupByDateColumn: 'created_at',
      // тип обходится намеренно: значение могло прийти из недоверенного ввода
      groupByDateGranularity: 'second; DROP TABLE x' as never,
      validColumns: ['region', 'created_at', 'revenue'],
    });
    const { sql } = compileQuery(params, 'duckdb');
    expect(sql).not.toContain('DROP TABLE');
    expect(sql).not.toContain('date_trunc');
    expect(sql).toContain(`"region" AS "_group_label"`);
    expect(sql).toContain('GROUP BY "region"');
    expect(sql).not.toContain('_date_label');
  });

  it('невалидный groupByColumn деградирует в NULL AS "_group_label"', () => {
    const params = makeParams({
      groupByColumn: 'hacked',
      validColumns: ['revenue'],
    });
    const { sql } = compileQuery(params, 'duckdb');

    expect(sql).toContain('NULL AS "_group_label"');
    expect(sql).not.toContain('GROUP BY');
  });
});

describe('compileQuery: calculated-метрики и CTE', () => {
  const calcParams = (formula: string) =>
    makeParams({
      groups: [
        makeGroup({
          metrics: [
            makeGroupMetric({
              id: 'mc',
              templateId: 'tpl-calc',
              fieldBindings: [
                { id: 'fb1', fieldAlias: 'a', columnName: 'col_a' },
                { id: 'fb2', fieldAlias: 'b', columnName: 'col_b' },
              ],
            }),
          ],
        }),
      ],
      metricTemplates: [makeCalculatedTemplate(formula)],
    });

  it('компилируемая формула превращается в цепочку CTE', () => {
    const { sql, calculatedInSqlAliases, formulas } = compileQuery(
      calcParams('a / b'),
      'duckdb'
    );

    expect(sql).toMatch(/^WITH __base AS \(/);
    expect(sql).toContain('__calc_g1__mc AS (');
    expect(sql).toContain('SELECT * FROM __calc_g1__mc');
    expect(calculatedInSqlAliases.has('g1__mc')).toBe(true);
    expect(formulas.get('base_g1__mc')?.formula).toBe('a / b');
  });

  it('зависимости полей агрегируются как SUM с префиксом _fb', () => {
    const { sql } = compileQuery(calcParams('a + b'), 'duckdb');

    expect(sql).toContain('AS "_fbg1_mc_a"');
    expect(sql).toContain('AS "_fbg1_mc_b"');
  });

  it('деление компилируется с NULLIF-защитой от деления на ноль', () => {
    const { sql } = compileQuery(calcParams('a / b'), 'duckdb');

    expect(sql).toContain('NULLIF');
  });

  it('некомпилируемая формула роняет ВСЕ метрики в fallback (без CTE)', () => {
    const { sql, calculatedInSqlAliases } = compileQuery(
      calcParams('sin(a)'), // sin не поддерживается SQL-компилятором
      'duckdb'
    );

    expect(sql).not.toContain('WITH');
    expect(calculatedInSqlAliases.size).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Falling back ALL calculated metrics')
    );
  });

  it('метрики с зависимостями сортируются топологически (зависимость раньше)', () => {
    const params = makeParams({
      groups: [
        makeGroup({
          metrics: [
            // mB зависит от mA, но объявлена первой
            makeGroupMetric({
              id: 'mB',
              templateId: 'tpl-b',
              fieldBindings: [],
              metricBindings: [{ id: 'mb1', metricAlias: 'x', metricId: 'mA' }],
            }),
            makeGroupMetric({
              id: 'mA',
              templateId: 'tpl-a',
              fieldBindings: [{ id: 'fb1', fieldAlias: 'a', columnName: 'col_a' }],
            }),
          ],
        }),
      ],
      metricTemplates: [
        makeCalculatedTemplate('x * 2', { id: 'tpl-b' }),
        makeCalculatedTemplate('a + 1', { id: 'tpl-a' }),
      ],
    });
    const { sql } = compileQuery(params, 'duckdb');

    const posA = sql.indexOf('__calc_g1__mA');
    const posB = sql.indexOf('__calc_g1__mB');
    expect(posA).toBeGreaterThan(-1);
    expect(posB).toBeGreaterThan(-1);
    expect(posA).toBeLessThan(posB);
  });

  it('циклическая зависимость не приводит к бесконечному циклу', () => {
    const params = makeParams({
      groups: [
        makeGroup({
          metrics: [
            makeGroupMetric({
              id: 'mA',
              templateId: 'tpl-a',
              fieldBindings: [],
              metricBindings: [{ id: 'x', metricAlias: 'b', metricId: 'mB' }],
            }),
            makeGroupMetric({
              id: 'mB',
              templateId: 'tpl-b',
              fieldBindings: [],
              metricBindings: [{ id: 'y', metricAlias: 'a', metricId: 'mA' }],
            }),
          ],
        }),
      ],
      metricTemplates: [
        makeCalculatedTemplate('b + 1', { id: 'tpl-a' }),
        makeCalculatedTemplate('a + 1', { id: 'tpl-b' }),
      ],
    });

    const { formulas } = compileQuery(params, 'duckdb');

    expect(formulas.size).toBe(2);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Circular dependency')
    );
  });
});
