# Phase 4 — P2 Корректность и производительность

## Цель

Закрыть пп. 8–13, 16–19 аудита: утечку Arrow-буферов, ложные метаданные кэша,
тихую деградацию при переполнении sessionStorage, дубль логики иерархии,
хрупкость formula-to-sql и React-ошибки.

## Изменения

### 4.1 Единый сервис удаления датасета (п.10 — утечка Arrow)

| Файл | Что сделано |
|------|-------------|
| `features/setup-dataset/model/remove-dataset.ts` | **Новый.** `removeDatasetCompletely`: DuckDB-таблица → `arrow:<id>` в IndexedDB → кэш вычислений → конфиги колонок → запись стора. Ступени изолированы (ошибка очистки не блокирует удаление) |
| `widgets/dataset-switcher/ui/DatasetSwitcher.tsx` | Удаление через сервис; `window.confirm` → `ConfirmDialog` |
| `features/setup-dataset/model/use-dataset-manager.ts` | Дедуп второго пути удаления; API `requestDelete/cancelDelete/confirmDelete` под ConfirmDialog |
| `widgets/setup-wizard/ui/SetupWizardContent.tsx` | Рендер ConfirmDialog |

### 4.2 computation-cache (пп. 8–9 + два сопутствующих бага)

- `FileComputationCache.set`: `sourceType: 'file'` (была копипаста `'postgres'`).
- Переполнение sessionStorage: вместо тихого `catch {}` — `console.warn`
  (→ logger в Phase 5) + fallback записи в IndexedDB; `get()` читает
  память → sessionStorage → IndexedDB.
- **Найдено при фиксе:** `PgComputationCache.clear()` вызывал
  `sessionStorage.clear()` — сносил ВЕСЬ sessionStorage приложения;
  `clearByDashboard` удалял ключи в цикле по индексам и пропускал элементы
  (removeItem сдвигает нумерацию). Оба исправлены.
- 10 юнит-тестов (моки sessionStorage и idb-keyval).

### 4.3 Иерархия — один путь (п.11)

Удалены `getHierarchyNodesLocal` (клиентский group-by по 500 preview-строкам,
расходился с полным датасетом) и `useHierarchyTree`. Единственный потребитель
использовал из него только `currentPath` — те же `dashboard.hierarchyFilters`
из стора; тяжёлая группировка считалась впустую на каждый рендер.
Остался один путь: `useHierarchyLevelNodes` через вычислительный движок.

### 4.4 formula-to-sql (п.12)

Диспетчер `visit()` переведён с `instanceof` классов mathjs на
`switch (node.type)` (строковый дискриминатор — стабильная часть API mathjs).
Структурные контракты нод описаны локальными интерфейсами.
Снапшот-тесты Phase 1 прошли без изменений — SQL идентичен.

### 4.5 React-фиксы (пп. 13, 16–19)

| Файл | Фикс |
|------|------|
| `widgets/dashboard-view/model/use-dashboard-computation.ts` | 2 × `useMemo` с записью в Zustand → `useEffect` (side-эффект во время рендера) |
| `widgets/dashboard-view/ui/DashboardViewContent.tsx` | Убран `useCallback` внутри `useShallow` (мемоизация селектора не нужна — сравнивается результат) |
| `app/providers/index.tsx` | Удалён no-op `isReady` (обе ветки рендерили одно и то же) |
| `widgets/dataset-switcher` | `StatusDot` вынесен на уровень модуля (создание компонента в рендере сбрасывает поддерево) |
| `widgets/group-view/model/use-group-view-state.ts` | Дефолты («первая метрика», «сортировка по первой») деривируются в рендере вместо setState-в-эффектах |
| `shared/ui/select.tsx` | Пустые интерфейсы → type-алиасы |
| `shared/lib/hooks/use-url-filters.ts` | `searchParams.toString()` из deps → переменная + JSDoc |

**Ложноположительное замечание аудита (п.18):** селектор в
`configure-table-metric/ui.tsx:28` возвращает результат `find()` — это
стабильная ссылка из состояния стора, Zustand корректно сравнивает её через
`Object.is`. Новый объект не создаётся; фикс не требуется.

## Решения и trade-offs

- **`react-hooks/set-state-in-effect` остаётся warn** (10 вхождений):
  это канонические mount-флаги/гидрация (`client-only`, `hydration`,
  `use-engine-status`) и синхронизация с async-источниками — механическая
  «починка» здесь рискованнее самого паттерна. Правила `use-memo`,
  `static-components`, `no-empty-object-type` возвращены в error (долг закрыт).
- IndexedDB-fallback добавлен только file-кэшу: PG-записи живут 5 минут,
  переживать перезагрузку им не нужно.

## Как проверено

`type-check` ✅, `lint` ✅ (0 errors), `build` ✅, `npm test` 78/78 ✅.
