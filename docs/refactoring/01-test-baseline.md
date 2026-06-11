# Phase 1 — Базовые тесты ядра вычислений

## Цель

Покрыть тестами ядро (`src/shared/lib/computation/`, `src/shared/lib/storage/`)
**до** его рефакторинга в Phase 2 (безопасность) и Phase 4 (formula-to-sql).
Эти пути не затрагиваются структурными переездами Phase 3 — тесты переживут
все фазы и служат «страховочной сеткой».

## Изменения

| Файл | Что сделано |
|------|-------------|
| `computation/lib/test-fixtures.ts` | Фабрики тестовых данных (`makeParams`, `makeGroup`, `makeAggregateTemplate`, …) |
| `computation/lib/query-compiler.test.ts` | 22 теста: оба диалекта, параметризация фильтров ($n, BETWEEN), экранирование DuckDB, блокировка операторов, валидация колонок, GROUP BY, CTE-цепочки calculated-метрик, топосорт, циклы, fallback на mathjs |
| `computation/lib/formula-to-sql.test.ts` | 20 тестов: константы, символы, операторы (NULLIF-защита деления, POWER), функции (LEAST/GREATEST, CASE WHEN, диалектный log10), ошибки компиляции |
| `computation/lib/aggregation.test.ts` | 9 тестов: суммирование _record_count, переагрегация SUM/MAX/MIN, взвешенный AVG через `__agg_sum__`/`__agg_count__`, непереагрегируемые COUNT_DISTINCT/MEDIAN → null, пересчёт формул на агрегатах |
| `storage/migration.ts` | **Починена сигнатура** под контракт Zustand + JSDoc |
| `storage/migration.test.ts` | 7 тестов: цепочка миграций, downgrade-защита, пропуски, иммутабельность |
| `computation/lib/post-process.test.ts` | 9 тестов: нормализация bigint, метрики из CTE без пересчёта, mathjs-пересчёт по `_fb`-зависимостям, резолв метрик-зависимостей, изоляция ошибок |

Итого: **67 тестов**.

## Решения и trade-offs

- **Зафиксировано небезопасное поведение** как есть: тесты
  `query-compiler.test.ts` → блок «валидация колонок и идентификаторов» явно
  документируют, что `tableName` интерполируется без проверки и что при
  `validColumns === undefined` любая колонка проходит. Phase 2 ужесточит
  PG-путь — диф этих тестов задокументирует security-изменение.
- **`createMigration` починен в этой фазе, а не в Phase 5**: функция читала
  `persisted.__version`, тогда как Zustand persist передаёт версию вторым
  аргументом `migrate(state, version)` и хранит её в обёртке localStorage.
  Использований не было — риск нулевой, а Phase 5 получит уже проверенный
  инструмент.
- Ожидаемые SQL-строки в тестах — инлайн (`toContain`/`toBe`), а не
  файлы-снапшоты: диф читается в PR, и тесты переживут переписывание
  `formula-to-sql` на `node.type` (Phase 4) только если SQL действительно
  не изменился.

## Как проверено

`npm test` — 67/67 ✅; `type-check` ✅; `lint` ✅ (0 errors).
