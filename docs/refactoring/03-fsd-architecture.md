# Phase 3 — P1 Архитектура FSD

## Цель

Устранить нарушения направления зависимостей (пп. 4–7, 20–23 аудита):
shared→entities, features→widgets, 21 глубокий импорт, каскады в entity-сторах,
непоследовательное именование. Включить блокирующий контроль границ.

## Изменения

### 3a. Контракты типов (`shared → entities` устранено)

| Было | Стало |
|------|-------|
| `entities/dashboard/model/types.ts` (Dashboard, виджеты, ColorConfig) | `shared/lib/types/dashboard.ts`; entity ре-экспортирует |
| `entities/metric` (DisplayFormat, AggregateFunction, MetricType, MetricDependency) | `shared/lib/types/metric.ts`; entity ре-экспортирует |
| `entities/hierarchy` (HierarchyLevel) | `shared/lib/types/hierarchy.ts`; entity ре-экспортирует |
| `entities/group-metric-config` (GroupMetricConfig) | `shared/lib/types/group-metric-config.ts` |
| `src/shared/shared/` (дубль KPIWidget) | **удалён**; kpi-compiler импортирует из shared/lib/types |

`config-export-service` / `config-import-service` больше не импортируют из entities.

### 3b. Разворот билдеров (features → widgets устранено)

| Было | Стало |
|------|-------|
| `widgets/group-builder` + `features/create-group` + `features/edit-group` | `features/group-builder` (ui: GroupBuilderUI, CreateGroupWidget, EditGroupWidget) |
| `widgets/dashboard-builder` + `features/create-dashboard` + `features/edit-dashboard` | `features/dashboard-builder` |
| `widgets/formula-builder` + `features/CreateMetricTemplate` | `features/metric-template` (TemplateForm + VisualFormulaBuilder) |

Обоснование: билдер — интерактивный пользовательский сценарий («создать
группу»), а не композиционный блок страницы. Тонкие фичи-обёртки были
симптомом инверсии — они стали ui-сегментами фич-билдеров.

### 3c. Kebab-case (единый стиль слайсов)

`indicatorGroup→indicator-group`, `columnConfig→column-config`,
`exportPackage→export-package`, `groupMetricConfig→group-metric-config`,
`groupView→group-view`, `AddKpiWidget→add-kpi-widget`,
`ConfigureTableMetric→configure-table-metric`,
`ConfigureGroupMetric→configure-group-metric`,
`DatasetSourceSelector→dataset-source-selector`.
Persist-ключи Zustand не тронуты (проверено grep'ом до/после).

### 3d. Public API + boundaries → error

- `widgets/shared` (псевдослайс) расформирован: `use-computation` →
  `shared/lib/computation/hooks/` (зависел только от shared),
  `use-engine-status` → `entities/dataset/lib/`.
- Добавлены недостающие экспорты public API: `entities/metric`
  (flattenDashboardResult, MetricCell), `entities/formula`
  (useFormulaValidation), `entities/export-package`, `features/hierarchy-filters`.
- Все 21 глубокий импорт переведены на `index.ts` слайсов.
- `eslint-plugin-boundaries`: `element-types` и `entry-point` — **error**.

### 3e. Каскады из entity-сторов

- `indicator-group/store.deleteGroup` теперь мутирует только своё состояние;
  каскад (отвязка от дашбордов, инвалидация кэша, очистка UI-конфигов) —
  в оркестраторе `features/delete-group/model/use-delete-group.ts`.
- `deleteDashboard` уже был чистым — изменений не потребовалось.
- `sync-engine` (6 getState, кросс-entity + toast) перенесён из
  `entities/dataset/model` в `features/setup-dataset/model` вместе с
  `use-file-import`; виджеты импортируют их из фичи.

## Решения и trade-offs

- **Same-layer cross-import разрешён** для widgets→widgets (композиция:
  dashboard-view встраивает kpi-grid, charts-section…) и features→features
  (билдеры используют metric-template). Это осознанные исключения FSD
  (аналог `@x` cross-import API); импорт мимо `index.ts` запрещён без
  исключений. Альтернатива — поднимать композицию в app-страницы — дала бы
  искусственный прокси-код без выигрыша в связности.
- **Entity ре-экспортирует shared-контракты**: потребители продолжают
  импортировать `Dashboard` из `@/entities/dashboard` — переезд типов не
  каскадировал по всей кодовой базе.
- `getState()` в оркестраторах features (`config-persistence`,
  `delete-group`) — легитимный паттерн: features и существуют для
  координации нескольких entity.

## Как проверено

`type-check` ✅, `lint` ✅ (0 errors, 62 warnings — остался только
зафиксированный долг react-hooks/no-unused-vars для Phase 4/5),
`build` ✅, `npm test` 68/68 ✅.
