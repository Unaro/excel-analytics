# Аудит кода: UrbanAnalytics

## Что это за приложение

Клиентское BI-приложение для градостроительной аналитики на **Next.js (App Router) + TypeScript + Zustand + DuckDB-WASM**. Архитектура — FSD (`app / widgets / features / entities / shared`). Вся аналитика считается **в браузере**: пользователь грузит Excel/CSV, файл парсится в Web Worker'е через `xlsx`, импортируется в DuckDB-WASM, а результаты кэшируются как Arrow-буфер в IndexedDB. Альтернативный источник — PostgreSQL через Server Actions.

## Как работает поток вычислений

1. **Импорт** (`sync-engine.ts` → `worker.ts`): файл → `parseExcelToJson` → DuckDB-таблица `dt_<id>` → экспорт Arrow в `idb-keyval` (ключ `arrow:<id>`) → 500 строк preview в стор.
2. **Гидрация** (`app/providers/hydration.ts`): при старте восстанавливает таблицы из Arrow-буфера обратно в Worker.
3. **Вычисление** (`use-computation.ts` → `engine-factory` → `DuckDbEngine`/`PgEngine`): UI собирает `ClientComputeParams` → `compileQuery()` строит SQL с CTE и топосортировкой calculated-метрик → DuckDB/PG исполняет → пост-обработка формул через mathjs.
4. Везде debounce + `AbortController` + версионирование запросов + многоуровневый кэш (`sessionStorage` + memory + IndexedDB-инвалидация).

Инженерный уровень местами высокий: топосорт зависимостей метрик, fallback DuckDB-формул на mathjs, prepared-statement LRU-кэш, чанковый импорт >50k строк. Но есть системные проблемы.

---

## Критические проблемы (безопасность и корректность)

**1. SQL-инъекция в PostgreSQL-движке.** `computePgMetrics` вызывает `client.unsafe(sql, queryParams)`, где `sql` собирается через конкатенацию строк в `compileQuery`. Параметризация (`$1, $2`) применяется только к значениям фильтров — но имена колонок, агрегатные выражения и **формулы** интерполируются напрямую. `quoteIdent` экранирует кавычки, но формула пользователя превращается в SQL через `FormulaToSqlCompiler` и вставляется в текст запроса. Поскольку это исполняется на сервере против чужой БД с пользовательскими кредами, поверхность атаки реальна. DuckDB-движок через `escapeDuckDBValue` экранирует значения вручную — для in-browser БД это терпимо, но идентификаторы колонок там тоже доверяются `validColumns`, который приходит из `DESCRIBE` (ок) либо из params (не ок при PG).

**2. Шифрование PG-паролей не даёт защиты.** `crypto.ts` генерирует AES-ключ и кладёт его в `sessionStorage` рядом с зашифрованным конфигом. Любой XSS читает и ключ, и шифртекст — это обфускация, а не шифрование. Хуже: расшифрованный `PgConnectionConfig` передаётся в Server Action как **обычный аргумент**, то есть пароль в плейнтексте летит на сервер. Модель угроз здесь несогласована — стоит либо честно назвать это «секрет хранится только на сессию», либо вынести коннект в серверный секрет-сторэдж.

**3. `ssl: { rejectUnauthorized: false }`** в `createPgClient` отключает проверку сертификата — MITM на PG-коннекте.

---

## Архитектурные проблемы (FSD)

**4. Нарушение направления зависимостей `shared → entities`.** `shared/lib/services/config-*-service.ts` импортирует типы из `@/entities/dashboard`. `shared` обязан быть листом графа. Лечится переносом контрактов (`Dashboard`, `KPIWidget` и пр.) в `shared/lib/types` — частично это уже сделано в `shared/shared/lib/types/dashboard.ts`, но **сам факт каталога `shared/shared/` — это симптом**: контракты расползлись.

**5. `features → widgets`.** `create-group`, `edit-group`, `create-dashboard`, `edit-dashboard`, `CreateMetricTemplate` импортируют из `@/widgets/*`. В FSD feature не может зависеть от widget (widget выше по слою). Здесь инверсия: «фича» — это тонкая обёртка над «виджетом»-билдером. Либо билдеры должны жить в features, либо обёртки — в widgets.

**6. Глубокие импорты мимо public API.** 17 мест импортируют `@/entities/dataset/model/sync-engine`, `@/widgets/*/model/use-*` напрямую, минуя `index.ts`. Это ломает инкапсуляцию слайса — рефакторинг внутренностей становится breaking change.

**7. Сильная связность сторов через `getState()`.** `indicatorGroup/store.ts` при `deleteGroup` дёргает `useDashboardStore`, `useDatasetStore`, `useGroupMetricConfigStore` и `createComputationCache`. Это скрытая каскадная логика внутри entity-стора — её место в feature (`delete-group`) как оркестратора. Сейчас entity знает о трёх других entity + про слой кэша.

---

## Проблемы корректности и производительности

**8. `FileComputationCache.set` помечает `sourceType: 'postgres'`** (копипаста) — метаданные кэша врут про источник.

**9. Кэш файлов в `sessionStorage`.** Полный `DashboardComputationResult` сериализуется в `sessionStorage` (лимит ~5 МБ). На больших дашбордах это тихо упадёт в `catch {}` и деградирует в memory-only без сигнала.

**10. Утечка Arrow-буферов.** При `removeDataset` (в сторе) запись `arrow:<id>` в IndexedDB удаляется только в `replaceDatasetFile`, но не в обычном удалении датасета из `DatasetSwitcher`/`useDatasetManager`. Буферы-сироты копятся в IndexedDB. Раздел «Привязка удалённых источников» — заглушка-плейсхолдер.

**11. Иерархия считается двумя путями.** Есть `getHierarchyNodesLocal` (полный клиентский group-by по 500 preview-строкам в JS) и `useHierarchyLevelNodes` (через движок с фейковым `buildDummyParams`). Дубль логики + риск расхождения preview (500 строк) и полного датасета.

**12. `ParenthesisNode`/`OperatorNode` в `formula-to-sql` — `instanceof` против mathjs-нод.** Хрупко при минификации/смене версии mathjs; уже есть `// fallback ALL calculated metrics to Math.js` — то есть один несовместимый узел роняет компиляцию всей пачки метрик в медленный JS-путь.

**13. `ProviderTheme` (`app/providers/index.tsx`) рендерит провайдер одинаково до и после `isReady`** — `useState/useEffect` там фактически no-op, комментарий не соответствует коду.

**14. Ноль тестов.** При такой плотности логики (топосорт, SQL-компиляция, агрегация, миграции) отсутствие unit-тестов — главный долг.

**Мелочи:** 88 `console.*` в проде; `validators.ts` опечатка в имени файла `fortmating-rules.ts`; `createMigration` написан, но нигде не подключён (сторы на голом `version: 2`); `DatasetSwitcher`/`useDatasetManager` дублируют логику удаления; `window.confirm`/`window.location.href` вместо роутера и диалогов.

---

## План рефакторинга по приоритету

**P0 — безопасность (сделать сейчас):**
- Параметризовать **всё** в PG-пути: имена таблиц/колонок — через белый список из `information_schema` (а не из клиентских params), значения — только через `$n`. Формулы валидировать AST'ом до компиляции и компилировать в whitelisted-выражения (это уже частично есть — ужесточить).
- Убрать `rejectUnauthorized: false` или сделать опциональным с явным согласием.
- Переосмыслить модель PG-секретов: либо серверный vault + handle вместо передачи конфига, либо честная коммуникация, что это session-only обфускация.

**P1 — архитектура FSD:**
- Вынести все cross-entity контракты в `shared/lib/types`, удалить `shared/shared/`, оборвать импорты `shared → entities`.
- Развернуть зависимость `features → widgets`: билдеры-движки переехать в features или ниже.
- Вынести каскадные удаления из entity-сторов в features-оркестраторы (`delete-group`, `delete-dashboard`).
- Запретить глубокие импорты: ESLint `no-restricted-imports` + `eslint-plugin-boundaries` со схемой слоёв FSD.

**P2 — корректность/перф:**
- Чинить `sourceType` в `FileComputationCache`.
- Полная очистка артефактов при `removeDataset` (Arrow в IDB, кэш, configs) — единым сервисом.
- Унифицировать иерархию на один движок; убрать `getHierarchyNodesLocal` либо явно пометить как «preview-only».
- Большие результаты — в IndexedDB вместо `sessionStorage`.

**P3 — гигиена:**
- Подключить `createMigration` к сторам с реальными миграциями.
- Логгер с уровнями вместо `console.*`, чистка в проде.
- Vitest: покрыть `query-compiler`, `formula-to-sql`, `aggregation`, `post-process`, `topologicalSort`, миграции — это ядро.
- Переименовать `fortmating-rules.ts`, дедуп логики удаления датасета.

---

# Дополнительные находки (углублённый аудит, 2026-06-11)

Повторная проверка подтвердила все 14 пунктов выше (точные файлы/строки — в
[docs/refactoring/](refactoring/00-overview.md)) и выявила новые проблемы.

## Безопасность (дополнение к п.1)

**15. Server Action без валидации входа.** `computePgMetrics` (`shared/api/server-actions/pg-compute.ts`) принимает `ClientComputeParams` **без Zod-схемы** — в отличие от `fetchPgTableData`, где конфиг валидируется. `params.tableName` строится на **клиенте** (`PgEngine.compute`, engine.ts:70–79) и интерполируется в `FROM ${tableName}` (query-compiler.ts:383, 484). `isColumnValid` (query-compiler.ts:151) пропускает любые колонки, когда `validColumns` не передан — а для PG он приходит из клиентских params, не из `information_schema`.

## React-корректность

**16. `useMemo` для side-эффектов.** `use-dashboard-computation.ts:113–119` — два `useMemo` пишут в Zustand-стор во время рендера. Должны быть `useEffect`.

**17. `useCallback` внутри `useShallow`.** `DashboardViewContent.tsx:68–75` — мемоизация селектора через `useCallback` бессмысленна и мешает shallow-сравнению.

**18. Селектор с новым объектом.** `ConfigureTableMetric/ui.tsx:28` — инлайн-селектор возвращает новый объект каждый рендер без `useShallow`.

**19. Линт фактически не работал.** `next lint` удалён в Next 16 — скрипт молча падал. После починки вскрылось 16 ошибок: 12 × `react-hooks/set-state-in-effect`, `react-hooks/use-memo`, `react-hooks/static-components` («Cannot create components during render» в group-view), 2 × `no-empty-object-type`.

## Архитектура (уточнение пп. 4–7)

**20. Масштаб глубоких импортов: 21** (не ~17), первопричина — **21 каталог `model/` без `index.ts`** (все 8 entities, 6 features, 7 widgets).

**21. `getState()` чужих сторов — 29 вызовов в 8 файлах**, не только `indicatorGroup`: `sync-engine.ts` (6), `use-config-persistence.ts` (13, допустимо для оркестратора), и др.

**22. Именование слайсов непоследовательно:** `AddKpiWidget`/`ConfigureTableMetric` (PascalCase) против `create-group` (kebab); `indicatorGroup`/`columnConfig` (camel) против `group-view`. Принято: kebab-case везде.

**23. Кросс-импорты widgets→widgets:** `dashboard-view`, `group-view`, `kpi-grid`, `sidebar` импортируют `@/widgets/shared/model/use-computation` — общий хук слайса-«виджета», который по сути принадлежит ниже (shared/entities).

## Состояние и данные

**24. Версии persist-сторов расходятся:** dashboard/indicatorGroup/hierarchy — `version: 2`, template-store/groupMetricConfig — `version: 1`; миграций нет.

**25. `createMigration` сломан по контракту Zustand:** читает `persisted.__version`, тогда как Zustand persist вызывает `migrate(state, version)` и хранит версию в обёртке JSON, не в state. Подключать без починки сигнатуры нельзя.

## Гигиена

**26. JSDoc:** ~43 % экспортируемых функций `shared/lib` без документации (все хуки `shared/lib/hooks/*`, утилиты `format`/`translit`/`crypto`, `computation-cache`, `prepared-statement-cache`).

**27. Тест-инфраструктуры нет вообще** (нет ни vitest/jest, ни скрипта `test`) — закрыто в Phase 0 рефакторинга.

**28. `NODE_ENV=production` в dev-окружении** заставляет npm пропускать devDependencies (`omit=dev`) — ставить через `npm install --include=dev`.

---

План выполнения и журнал рефакторинга: [docs/refactoring/00-overview.md](refactoring/00-overview.md).