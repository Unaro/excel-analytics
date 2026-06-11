# Карта слоёв FSD (актуальное состояние)

Направление зависимостей: `app → widgets → features → entities → shared`.
Контроль — `eslint-plugin-boundaries` (error). Импорт чужого слайса — только
через его `index.ts`. Same-layer cross-import разрешён для widgets и features
(композиция через public API).

## app (роуты Next.js)
`dashboards/`, `groups/`, `hierarchy/`, `metrics/`, `settings/`, `setup/`,
`providers/` (гидрация Arrow→DuckDB, тема).

## widgets (композиционные блоки страниц)
| Слайс | Назначение |
|-------|-----------|
| dashboard-view, dashboard-list, dashboard-metrics-table | Просмотр дашбордов |
| group-view, group-list | Просмотр групп показателей |
| kpi-grid, charts-section | Визуализация метрик |
| hierarchy-builder, hierarchy-filter | Иерархии |
| dataset-switcher, file-uploader, postgres-connection-form, postgres-table-browser, setup-wizard | Источники данных |
| data-table-viewer, raw-data-viewer, column-manager | Данные |
| metrics-manager, template-manager | Управление шаблонами метрик |
| sidebar, mobile-nav, settings | Каркас |

## features (пользовательские сценарии)
| Слайс | Сценарий |
|-------|----------|
| group-builder | Создать/отредактировать группу (поглотил create-group, edit-group) |
| dashboard-builder | Создать/отредактировать дашборд (поглотил create/edit-dashboard) |
| metric-template | Создать шаблон метрики (TemplateForm + VisualFormulaBuilder) |
| setup-dataset | Импорт/синк источников (sync-engine, use-file-import) |
| delete-group, delete-dashboard | Каскадные удаления (оркестраторы) |
| config-persistence | Экспорт/импорт конфигурации |
| hierarchy-filters | Применение фильтров иерархии |
| add-kpi-widget, configure-table-metric, configure-group-metric, dataset-source-selector, system-reset | Точечные сценарии |

## entities (бизнес-сущности: store + types + ui-атомы)
dashboard, indicator-group, metric, dataset, hierarchy, formula,
column-config, group-metric-config, group-view, export-package.

Правило: entity-стор мутирует только своё состояние; каскады — в features.

## shared (без зависимостей от верхних слоёв)
- `lib/computation` — ядро: query-compiler, formula-to-sql, движки
  (DuckDB-WASM worker / PG через Server Action), hooks/use-computation.
- `lib/types` — кросс-слойные контракты (dashboard, metric, hierarchy,
  group-metric-config, computation, dataset).
- `lib/validators` — Zod-схемы (single source of truth для доменных типов).
- `api` — postgres-клиент, server-actions (+ schemas.ts с Zod входов).
- `lib/storage` — кэш вычислений, миграции persist.
- `ui` — UI-кит.
