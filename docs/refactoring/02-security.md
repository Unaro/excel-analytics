# Phase 2 — P0 Безопасность

## Цель

Закрыть три критические проблемы аудита: SQL-инъекцию в PostgreSQL-пути (п.1, 15),
отключённую проверку TLS-сертификата (п.3) и несогласованную модель PG-секретов (п.2).

## Изменения

### 2a. SQL-инъекция в PG-пути

| Файл | Что сделано |
|------|-------------|
| `shared/api/server-actions/schemas.ts` | **Новый.** `PgConfigSchema` (перенесена из postgres.ts) + `ClientComputeParamsSchema`. Вынесены из 'use server'-файлов (те могут экспортировать только async-функции) |
| `shared/api/server-actions/pg-compute.ts` | Полностью переписан: Zod-parse обоих аргументов; клиентские `tableName`/`validColumns` игнорируются; существование таблицы проверяется в `information_schema.columns`, оттуда же берётся whitelist колонок; имя таблицы строится на сервере. Возвращает `validColumns` клиенту |
| `shared/lib/computation/lib/sql-utils.ts` | **Новый.** `quoteIdent` + `qualifiedTableName` — единая точка экранирования идентификаторов (раньше дублировались в query-compiler и engine) |
| `shared/lib/computation/lib/query-compiler.ts` | `validColumns` **обязателен** для диалекта `postgres` (throw); JSDoc с моделью безопасности |
| `shared/lib/computation/lib/postgres/engine.ts` | Не строит `tableName` для отправки; перекомпилирует метаданные пост-обработки на `validColumns` из ответа сервера |
| `shared/api/postgres/client.ts` | `withPgClient` перенесён сюда (дедуп между server-action файлами) |
| `query-compiler.test.ts` | Обновлён: тест «PostgreSQL без validColumns → ошибка», PG-кейсы переведены на `makePgParams` |

Цепочка доверия после фикса: клиент присылает только `pgSchema`/`pgTable` →
сервер валидирует Zod'ом → подтверждает таблицу по `information_schema` →
сам строит `"schema"."table"` и whitelist колонок → значения фильтров уходят
позиционными параметрами `$n`. Формулы по-прежнему компилируются
`FormulaToSqlCompiler`'ом, который является белым списком сам по себе
(только разрешённые функции, символы только из карт алиасов).

### 2b. TLS

| Файл | Что сделано |
|------|-------------|
| `shared/api/postgres/client.ts` | `rejectUnauthorized: !config.sslAllowInvalidCerts` — проверка по умолчанию |
| `shared/api/server-actions/schemas.ts` | Поле `sslAllowInvalidCerts` (default false) |
| `widgets/postgres-connection-form/ui.tsx` | Чекбокс «Доверять недействительным сертификатам» виден только при включённом SSL; при включении — предупреждение о MITM |

### 2c. Честные секреты

| Файл | Что сделано |
|------|-------------|
| `shared/lib/utils/crypto.ts` | Удалена миграция из localStorage и console.log; модульный JSDoc честно называет схему «сессионной обфускацией, не защитой от XSS» |
| `docs/security/pg-credentials-threat-model.md` | **Новый.** Полная модель угроз: что защищено, что осознанно нет, обязательные практики (read-only учётка, HTTPS) |
| `widgets/postgres-connection-form/ui.tsx` | Постоянная плашка: «пароль хранится только в текущей сессии… не используйте учётные записи с правами записи» |

## Решения и trade-offs

- **Server vault отвергнут** (решение пользователя): приложение остаётся
  client-first без серверного состояния. Вместо ложного чувства безопасности —
  задокументированная модель угроз и предупреждение в UI.
- **`computePgMetrics` возвращает `validColumns`**: клиентскому движку нужны
  метаданные компиляции (formulas, aggregateMetadata) для пост-обработки.
  Map несериализуем через границу Server Action, поэтому клиент перекомпилирует
  запрос локально — на whitelist'е, полученном с сервера, чтобы метаданные
  гарантированно совпадали с фактически исполненным SQL.
- **DuckDB-путь не ужесточён**: БД исполняется в браузере пользователя,
  `tableName` формируется кодом (`dt_<id>`), а `validColumns` приходит из
  `DESCRIBE` в воркере. Инъекция здесь = self-XSS без выхода за пределы вкладки.

## Как проверено

`type-check` ✅, `lint` ✅ (0 errors), `build` ✅, `npm test` 68/68 ✅.
Интеграционно с живым PostgreSQL не проверялось — рекомендуется ручной
смоук-тест подключения и вычисления дашборда на PG-источнике.
