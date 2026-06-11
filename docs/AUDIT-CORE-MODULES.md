# Аудит ядра системы: вычислительный движок, сторы, хуки

Дата: 2026-06-11 (после завершения рефакторинга P0–P3, см. [refactoring/00-overview.md](refactoring/00-overview.md)).
Исправленные ранее проблемы ([AUDITE.md](AUDITE.md)) не дублируются — здесь только **актуальное** состояние.

Ключевые находки проверены вручную по коду (file:line актуальны на момент аудита).

---

## 1. Вычислительный движок (`shared/lib/computation`)

### 1.1 ⚠️ HIGH — Молчаливое усечение breakdown через LIMIT 1000

`query-compiler.ts:461, 499` — оба пути сборки SQL (CTE и fallback) ставят
`LIMIT 1000` при `groupByColumn`. Если значений группировки больше тысячи,
пользователь видит **неполную таблицу без какого-либо индикатора**. Для
BI-инструмента это искажение данных: суммы по breakdown не сойдутся с «Итого»
(сводка считается по полному датасету).

**Фикс:** запрашивать `LIMIT 1001`, при получении 1001 строки выставлять
флаг `truncated: true` в `GroupComputationResult` и показывать предупреждение в UI.

### 1.2 ⚠️ MEDIUM — AbortSignal не доходит до воркера

`manager.ts:262-290` — `computeDashboard` проверяет `signal.aborted` до и
после `dispatch('COMPUTE')`, но сам сигнал в воркер **не передаётся**.
Уже запущенный SQL в DuckDB-WASM доработает до конца, удерживая CPU вкладки.
При быстрой смене фильтров тяжёлые отменённые запросы выстраиваются в очередь
в воркере (он однопоточный) и задерживают актуальный.

**Фикс:** передавать id отменяемого запроса сообщением `CANCEL` в воркер +
`conn.cancelSent()` / пересоздание соединения, либо хотя бы выбрасывать
отменённые задачи из очереди до исполнения.

### 1.3 ⚠️ MEDIUM — Повторная компиляция mathjs-формул на каждый compute

`post-process.ts:51-61` и `recalculateFormulasOnAggregated` — формулы
компилируются (`safeMath.compile`) заново при каждом вызове, т.е. на каждое
изменение фильтра, дважды (построчная пост-обработка + сводка). При 10+
calculated-метриках это десятки парсингов AST на взаимодействие.

**Фикс:** LRU-кэш `Map<formulaString, CompiledFormula>` на уровне модуля.

### 1.4 ⚠️ MEDIUM — `findMetricValue`: O(n)-скан с fallback на чужие группы

`post-process.ts:189-201` — при отсутствии точного ключа
`${groupId}__${metricId}` значение зависимости ищется полным перебором
`Object.entries` по `endsWith`. Две проблемы:
- **семантика**: fallback может вернуть значение той же метрики из *другой
  группы* — для межгрупповых зависимостей это, возможно, намеренно, но нигде
  не задокументировано и срабатывает молча;
- **перф**: O(всех алиасов) на каждую зависимость каждой строки breakdown.

**Фикс:** построить `Map<metricId, value>` один раз на строку; семантику
межгруппового fallback'а задокументировать или запретить.

### 1.5 ⚠️ MEDIUM — Stale-кэш PG из-за фабрики «инстанс на хук»

`computation-cache.ts` + `engine-factory` — `createComputationCache()`
создаёт **новый инстанс** с собственным `memoryStore` на каждый вызов
(каждый смонтированный хук). Для `PgComputationCache.clear()` это означает:
очищается память *своего* инстанса и sessionStorage, но `memoryStore`
соседних инстансов (другие хуки/виджеты) сохраняет устаревшие записи —
и `get()` вернёт их после того, как sessionStorage очищен. File-кэш защищён
(инвалидация через отметку в IndexedDB), PG-кэш — нет.

Дополнительно: `memoryStore` не ограничен по размеру (нет eviction), хотя
рост ограничен временем жизни хука.

**Фикс:** сделать memoryStore модульным синглтоном (общим на sourceType)
с LRU-лимитом — это одновременно чинит stale-hit и убирает дублирование
записей между инстансами.

### 1.6 ℹ️ LOW — DESCRIBE на каждый COMPUTE

`worker.ts:268-284` — перед каждым вычислением воркер запрашивает схему
таблицы. Запрос дешёвый, но это лишний round-trip на каждое изменение
фильтра. Схема меняется только при импорте/замене файла.

**Фикс:** кэш схемы в воркере, инвалидация в обработчиках `IMPORT_*`/`DROP_TABLE`.

### 1.7 ℹ️ LOW — Линейные поиски при компиляции запроса

`query-compiler.ts:214, 224` (`metricTemplates.find`, `fieldBindings.find`
внутри двойного цикла) — O(групп × метрик × шаблонов). При текущих масштабах
(десятки метрик) незаметно; станет заметно от ~100+ метрик. Лечится
предварительными `Map<id, …>`.

### 1.8 ℹ️ LOW — Чанковый импорт: нет отката при ошибке батча

`worker.ts:453-512` — сам механизм хороший (батчи 25k, yield в event loop,
прогресс). Но ошибка INSERT одного батча не откатывает предыдущие — таблица
останется частично заполненной, а COUNT(*) после импорта это не ловит как ошибку.

**Принятые trade-off'ы (не дефекты):** двойная компиляция запроса для PG
(сервер исполняет, клиент строит метаданные пост-обработки на серверном
whitelist'е — задокументировано в [refactoring/02-security.md](refactoring/02-security.md));
Arrow-буфер существует и в воркере, и в IndexedDB (персистентность для гидрации).

---

## 2. Сторы (Zustand)

### 2.1 ⚠️ HIGH — `computed-store` — мёртвый стор с утечкой результатов

`entities/metric/model/computed-store.ts` — проверено: единственный
потребитель — `use-dashboard-computation.ts:110-111`, и он только **пишет**
(`setDashboardResult`, `setComputingState`). Читателей `getDashboardResult`
и всего `metricCache` (Map с TTL-логикой) — **ноль** во всей кодовой базе.

Последствия: каждый посещённый дашборд оставляет полный
`DashboardComputationResult` в `dashboardResults: Map` без eviction —
дублирование памяти (результат уже есть в state хука и в computation-cache)
плюс лишний write на каждый compute.

**Фикс:** удалить стор целиком вместе с записью из
`use-dashboard-computation` (либо, если планировалась межвиджетная шина
результатов, — задокументировать и добавить читателей + eviction).

### 2.2 ⚠️ MEDIUM — Подписка на весь стор в билдере и фильтрах

- `features/dashboard-builder/model/use-dashboard-builder.ts:12`
- `features/hierarchy-filters/model/use-filter-actions.ts:11-15`

`useDashboardStore()` **без селектора** — компонент ререндерится на любое
изменение любого дашборда (включая запись результатов вычислений соседних
виджетов через `hierarchyFilters`/`updatedAt`). Билдер с формой — самое
дорогое место для лишних ререндеров. Экшены стора стабильны — достаточно
`useDashboardStore(s => s.addHierarchyFilter)` либо разовое
`useDashboardStore.getState()` внутри колбэков.

### 2.3 ⚠️ MEDIUM — `removeDatasetCompletely` не чистит уровни иерархии

`features/setup-dataset/model/remove-dataset.ts` — сервис чистит DuckDB,
Arrow, кэш и конфиги колонок, но `levelsByDataset[datasetId]` в
`hierarchy-storage` остаётся навсегда (persist). Оrphan-данные копятся при
каждом удалении датасета. (Сохранение групп/дашбордов — намеренное,
о нём говорит текст диалога; уровни иерархии под это намерение не подпадают —
они привязаны к колонкам удалённых данных.)

**Фикс:** добавить `useHierarchyStore.getState().clearDatasetLevels(datasetId)`
в сервис.

### 2.4 ℹ️ LOW — `hierarchyFilters` (runtime-состояние) персистится

`entities/dashboard/model/store.ts` — активные фильтры дашборда хранятся
внутри persisted `dashboards`. Это runtime-значение: после перезагрузки
пользователь получает «застрявший» фильтр; экспорт конфигурации их уже
сбрасывает вручную (`filterByDataset`). Чистое решение — `partialize`
с исключением `hierarchyFilters`, либо отдельный непersisted стор фильтров.

### 2.5 ℹ️ LOW — `immer` в зависимостях не используется

Ни одного импорта по всему `src/`. Удалить из package.json или начать
использовать в глубоких обновлениях dashboard-стора (вложенные map по
widgets/kpiWidgets там самые многословные).

Положительное: `dataset-store` персистит метаданные без `rows` (кастомный
idb-storage), `getAllData` возвращает стабильный `EMPTY_ROWS`, system-reset
чистит всё согласованно.

---

## 3. Хуки

### 3.1 ⚠️ MEDIUM — `use-computation`: двойной триггер авто-исполнения

`hooks/use-computation.ts:171-175` — эффект зависит и от `...deps`
(контентные хеши), и от `execute`, которая пересоздаётся через
`executeInternal` при каждой смене `buildParams`/`buildCacheKey` (а они в
вызывающих хуках пересоздаются по тем же данным). Итог: одно изменение
фильтра запускает эффект дважды (по deps и по identity `execute`). Debounce
схлопывает это в один compute, поэтому пользователь не страдает, но
контракт хрупкий: вызывающий хук, забывший `useCallback` у `buildParams`,
получит compute на **каждый рендер** (debounce превратит это в постоянную
100ms-пульсацию). JSDoc-требование к стабильности колбэков нигде не записано.

**Фикс:** хранить `buildParams`/`buildCacheKey` в ref (обновлять эффектом),
из deps эффекта оставить только `autoExecute` и `...deps`; в JSDoc хука
зафиксировать контракт.

### 3.2 ⚠️ MEDIUM — `use-hierarchy-level-nodes`: отмена флагом, без AbortSignal

`entities/hierarchy/lib/hooks/use-hierarchy-level-nodes.ts:106+` —
эффект использует `cancelled`-флаг, но:
- `engine.compute(params)` вызывается **без** signal — вычисление в воркере
  не отменяется (умножается на проблему 1.2);
- инстанс хука живёт на каждый раскрытый уровень дерева; быстрый drill-down
  порождает параллельные compute, которые доработают зря;
- `cache.get()` не обёрнут в try/catch — ошибка кэша уронит эффект без
  `setIsLoading(false)`.

**Фикс:** AbortController как в `use-computation` + передача signal в
`engine.compute`; try/catch вокруг кэша с переходом к вычислению.

### 3.3 ⚠️ MEDIUM — Три независимых compute на одно действие пользователя

Трасса «пользователь сменил фильтр иерархии»:
1. `use-dashboard-computation` — полный compute дашборда (debounce 100ms);
2. `use-kpi-calculation` — **отдельный** compute по синтетической KPI-группе
   с теми же фильтрами;
3. `use-hierarchy-level-nodes` — по одному compute на раскрытый уровень дерева.

KPI и основной дашборд гоняют два разных SQL по одной таблице с одинаковым
WHERE. На DuckDB это терпимо (локально), на PG — два сетевых запроса +
два information_schema-чека. Архитектурно напрашивается объединение KPI-группы
в основной `compileQuery` (один проход по данным) — kpi-compiler уже создаёт
совместимые структуры.

### 3.4 ℹ️ LOW — Несогласованные deps у вызовов `useComputation`

Конвенция — передавать контентные хеши, но:
- `use-kpi-calculation.ts:156`: `deps: [configHash, filtersHash, widgets.length]`
  (`widgets.length` — слабый сигнал: замена виджета без смены количества
  не дёрнет пересчёт, если не изменился configHash);
- `use-group-breakdown.ts:169`: в deps массив `currentPath` (новая ссылка на
  каждый setState) рядом с уже покрывающим его `filtersHash` — лишний триггер.

**Фикс:** только примитивы/хеши в deps; `currentPath` убрать.

### 3.5 ℹ️ LOW — `engine.dispose()` никогда не вызывается

`use-computation.ts` создаёт движок через `useMemo`, cleanup эффекта не
вызывает `dispose`. Сейчас обе реализации no-op, но контракт `IComputeEngine`
подразумевает освобождение ресурсов — стоит вызвать в cleanup, чтобы будущая
реализация не утекла.

---

## Сводная таблица приоритетов

| # | Находка | Где | Severity | Когда болит |
|---|---------|-----|----------|-------------|
| 1 | LIMIT 1000 молча усекает breakdown | query-compiler.ts:461,499 | **HIGH** | >1000 значений группировки — искажение данных |
| 2 | computed-store: запись без читателей, рост Map | computed-store.ts | **HIGH** | Много дашбордов за сессию — память + мёртвый код |
| 3 | AbortSignal не отменяет работу воркера | manager.ts:262 | MEDIUM | Большие датасеты + частая смена фильтров |
| 4 | Stale-hit PG-кэша между инстансами | computation-cache.ts | MEDIUM | Несколько виджетов на PG-источнике |
| 5 | Повторная компиляция формул mathjs | post-process.ts:51 | MEDIUM | 10+ calculated-метрик |
| 6 | findMetricValue: скан + межгрупповой fallback | post-process.ts:189 | MEDIUM | Метрики-зависимости в нескольких группах |
| 7 | Full-store подписка в билдере/фильтрах | use-dashboard-builder.ts:12 | MEDIUM | 5+ дашбордов, активное редактирование |
| 8 | remove-dataset не чистит уровни иерархии | remove-dataset.ts | MEDIUM | Накопление orphan-данных в persist |
| 9 | Двойной триггер авто-исполнения compute | use-computation.ts:175 | MEDIUM | Хрупкий контракт buildParams |
| 10 | hierarchy-nodes без AbortSignal | use-hierarchy-level-nodes.ts:106 | MEDIUM | Быстрый drill-down по дереву |
| 11 | KPI + дашборд = два SQL по одним данным | use-kpi-calculation.ts | MEDIUM | PG-источники (2× сеть) |
| 12 | DESCRIBE на каждый compute | worker.ts:268 | LOW | Каждое изменение фильтра |
| 13 | hierarchyFilters в persist | dashboard/store.ts | LOW | UX после перезагрузки |
| 14 | deps-разнобой у useComputation | use-kpi-calculation, use-group-breakdown | LOW | Лишние пересчёты |
| 15 | Линейные find в компиляторе | query-compiler.ts:214 | LOW | 100+ метрик |
| 16 | Импорт: нет отката батча; immer не используется; dispose не вызывается | worker.ts:489; package.json; use-computation.ts | LOW | Редкие сценарии |

## Рекомендуемый порядок работ

1. **Корректность данных:** №1 (флаг truncated + индикатор в UI), №6 (семантика fallback), №4 (общий memoryStore).
2. **Память/мёртвый код:** №2 (удалить computed-store), №8 (clearDatasetLevels).
3. **Отзывчивость:** №3 + №10 (сквозная отмена до воркера), №7 (селекторы), №5 (кэш компиляции формул).
4. **Архитектура:** №11 (объединить KPI в основной запрос) — наибольший выигрыш для PG-режима.
5. Остальное — фоном при касании файлов.
