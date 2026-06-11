# Phase 5 — P3 Гигиена

## Цель

Закрыть пп. 24–26 и «мелочи» аудита: логирование, миграции persist,
опечатки в именах файлов, `window.confirm`, JSDoc.

## Изменения

### 5.1 Логгер

| Файл | Что сделано |
|------|-------------|
| `shared/lib/logger.ts` | **Новый.** Уровни debug/info/warn/error; debug и info отключены в production. Соглашение: первый аргумент — тег `[module]` |
| 23 файла | 93 вызова `console.*` заменены: log/debug → `logger.debug`, info → `logger.info`, warn/error → соответствующие уровни |
| `eslint.config.mjs` | `no-console: error` (исключения: сам логгер, тесты) |
| `duckdb/worker.ts` | Локальный `ConsoleLogger` DuckDB переименован в `duckdbLogger` (затенял импорт) |

### 5.2 Миграции persist-сторов

Все 6 сторов получили `migrate: createMigration(...)` (контракт починен в Phase 1).
Раньше при несовпадении версии Zustand **молча отбрасывал** состояние пользователя.

| Стор | Версия | Миграция |
|------|--------|----------|
| dashboard-storage | 2 | v1→v2: гарантия опциональных коллекций (virtualMetrics, kpiWidgets, …) |
| hierarchy-storage | 2 | v1→v2: явный сброс уровней (v1 не имел привязки к датасету — перенести невозможно) |
| indicator-group-storage | 2 | v1→v2: перенос как есть |
| column-config-storage | 2 | v1→v2: перенос как есть |
| metric-template-storage | 1 | v0→v1: перенос как есть |
| group-metric-config-storage | 1 | v0→v1: перенос как есть |

### 5.3 Переименования и диалоги

- `fortmating-rules.ts` → `formatting-rules.ts` (+ импорты).
- `TemplateManager`: `confirm()` → `ConfirmDialog`.
- Замена файла датасета (`use-dataset-replace`): `window.confirm` → диалоговый
  API (`pendingReplace`/`confirmReplace`/`cancelReplace`) + ConfirmDialog
  в setup-wizard.
- **Осознанно оставлены:** `window.location.href` в `system-reset` (полный
  сброс требует перезагрузки JS-контекста, включая DuckDB-воркер) и в
  `hydration.ts` (toast-экшен живёт вне React-дерева, роутер недоступен).

### 5.4 JSDoc

Задокументированы все экспортируемые функции `shared/lib` (на русском):
хуки, утилиты, ядро вычислений, сервисы, Zod-схемы. Финальный grep-аудит:
0 экспортируемых функций без JSDoc в `shared/lib`.

## Как проверено

`type-check` ✅, `lint` ✅ (0 errors; warnings — только осознанный
`set-state-in-effect` и no-unused-vars в неизменённых файлах),
`build` ✅, `npm test` 78/78 ✅.
