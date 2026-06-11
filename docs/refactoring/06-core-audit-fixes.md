# Фаза 6. Исправления по аудиту ядра + баг осиротевших показателей

Дата: 2026-06-11. Основание: [AUDIT-CORE-MODULES.md](../AUDIT-CORE-MODULES.md)
(рекомендуемый порядок работ, группы 1–3) + баг, обнаруженный пользователем.

## Цель

Закрыть находки аудита ядра, влияющие на корректность данных, память и
отзывчивость, и починить невозможность удалить из группы показатель,
чей шаблон формулы был удалён.

## Изменения

### Баг: осиротевший показатель нельзя удалить из группы

`features/group-builder/ui/MetricRow.tsx` — при отсутствии шаблона строка
вообще не рендерилась (`return null`), показатель «застревал» в группе без
возможности удаления. Теперь рендерится деградированная строка с предупреждением
(«Шаблон формулы удалён…») и кнопкой удаления. В расчётах такие показатели
не участвуют (компилятор пропускает их через `if (!tpl) continue`).

### №1 (HIGH) — молчаливое усечение breakdown через LIMIT 1000

- `query-compiler.ts` — экспортируемая константа `BREAKDOWN_LIMIT = 1000`;
  SQL запрашивает `LIMIT 1001`: лишняя строка — сигнал усечения потребителю.
- `duckdb/worker.ts`, `postgres/engine.ts` — при 1001 строке массив обрезается
  до 1000 **до** пост-обработки (сводка и breakdown считаются по одному набору)
  и выставляется `breakdownTruncated: true`.
- `shared/lib/types/computation.ts` — поле `breakdownTruncated?: boolean`
  в `GroupComputationResult`.
- `group-view/ui/GroupBreakdownTable.tsx` — янтарное предупреждение об усечении;
  заодно убран устаревший текст «(лимит 100)».
- Серверный экшен PG использует тот же `compileQuery` — лимит доходит до базы.

### №2 (HIGH) — удалён мёртвый computed-store

`entities/metric/model/computed-store.ts` удалён целиком: единственный
потребитель только писал в него (`use-dashboard-computation`), читателей —
ноль, `dashboardResults: Map` рос без eviction. Результат живёт в state хука
и в computation-cache.

### №3 + №10 — сквозная отмена вычислений до воркера

- `duckdb/manager.ts` — `dispatch()` принимает `AbortSignal`: при abort промис
  отклоняется `AbortError`, воркеру уходит сообщение `CANCEL { targetId }`.
- `duckdb/worker.ts` — `CANCEL` обрабатывается до `initDB`; набор
  `cancelledComputeIds` (с защитой от роста) и три контрольные точки в COMPUTE:
  до DESCRIBE, перед тяжёлым SQL, перед пост-обработкой. Пока COMPUTE ждёт
  `await conn.query()` (SQL исполняется во внутреннем воркере duckdb-wasm),
  наш event loop свободен и успевает принять CANCEL.
- `use-hierarchy-level-nodes.ts` — AbortController вместо одного
  cancelled-флага, сигнал передаётся в `engine.compute`; `cache.get` обёрнут
  в try/catch (ошибка кэша больше не роняет эффект без `setIsLoading(false)`).

**Trade-off:** уже запущенный SQL внутри duckdb-wasm не прерывается
(materialized `conn.query()` не поддерживает мягкую отмену) — но отменённые
задачи выбрасываются из очереди до исполнения, а их результаты
не сериализуются.

### №4 — общий memoryStore кэша с LRU

`storage/computation-cache.ts` — memory-слой стал модульным синглтоном
(по одному на sourceType, лимит 50 записей, LRU-вытеснение через порядок
вставки Map). Чинит stale-hit PG-кэша: раньше `clear()` чистил память только
своего инстанса, а соседние хуки продолжали отдавать устаревшие записи.
Заодно `FileComputationCache.clear()` без datasetId теперь чистит память
и sessionStorage, а не только IndexedDB.

### №5 — кэш компиляции mathjs-формул

`post-process.ts` — модульный LRU-кэш `formulaCache` (лимит 200): парсинг AST
выполняется один раз на формулу, а не на каждый compute дважды.

### №6 — findMetricValue: O(1)-индекс + документированный fallback

`post-process.ts` — вместо полного перебора `Object.entries` по `endsWith`
на каждую зависимость каждой строки — индекс `metricId → ключ`, который
строится один раз на строку и пополняется по мере вычисления метрик.
Межгрупповой fallback задокументирован в JSDoc как осознанная семантика
(переиспользование шаблона между группами).

### №7 — точечные селекторы вместо full-store подписок

- `features/dashboard-builder/model/use-dashboard-builder.ts`
- `features/hierarchy-filters/model/use-filter-actions.ts`
- `features/group-builder/model/use-group-builder.ts`
- `widgets/template-manager/ui/TemplateManager.tsx`

Экшены Zustand стабильны — подписка на весь стор ререндерила формы билдеров
на любое изменение любого дашборда/группы.

### №8 — очистка уровней иерархии при удалении датасета

`features/setup-dataset/model/remove-dataset.ts` — добавлен вызов
`useHierarchyStore.getState().clearDatasetLevels(datasetId)`: уровни привязаны
к колонкам удаляемых данных и копились в persist как orphan-записи.
Группы и дашборды сохраняются намеренно.

## Решения и trade-offs

- **LIMIT 1001 вместо подсчёта COUNT(DISTINCT)** — отдельный COUNT-запрос
  удвоил бы стоимость каждого compute ради точного числа групп; для индикатора
  усечения достаточно факта «есть 1001-я строка».
- **«Итого» при усечении считается по видимым строкам** — честно сообщается
  в предупреждении UI. Альтернатива (отдельная сводка по полному датасету)
  требует второго запроса — отложено до запроса пользователей.
- **CANCEL не прерывает уже исполняющийся SQL** — duckdb-wasm не даёт мягкой
  отмены materialized-запроса; принятый компромисс описан выше.
- №11 (объединение KPI-запроса в основной compileQuery) — отложено: крупное
  архитектурное изменение, делается отдельной фазой.

## Как проверено

`npm run type-check` ✅ · `npm run lint` — 0 ошибок ✅ ·
`npm run build` ✅ · `npm test` — 78/78 ✅
(тест компилятора обновлён под `LIMIT ${BREAKDOWN_LIMIT + 1}`).
