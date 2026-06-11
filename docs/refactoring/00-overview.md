# Рефакторинг UrbanAnalytics — обзор

Выполняется по результатам аудита ([docs/AUDITE.md](../AUDITE.md), включая раздел
«Дополнительные находки»). Ветка: `develop`.

## Гейт верификации

После каждой фазы (в рискованных — после каждого коммита):

```bash
npm run type-check && npm run lint && npm run build && npm test
```

## Definition of Done фазы

- Гейт зелёный (lint: 0 errors; warnings допустимы до Phase 3d).
- Все экспортируемые функции затронутых модулей имеют JSDoc на русском.
- Документ фазы заполнен: Цель / Изменения / Решения и trade-offs / Как проверено.

## Фазы

| # | Документ | Содержание | Статус |
|---|----------|------------|--------|
| 0 | (этот файл) | Vitest, ESLint-границы FSD (warn), документация | ✅ |
| 1 | [01-test-baseline.md](01-test-baseline.md) | Тесты ядра вычислений до его рефакторинга | ✅ |
| 2 | [02-security.md](02-security.md) | P0: SQL-инъекция PG-пути, TLS, модель секретов | ✅ |
| 3 | [03-fsd-architecture.md](03-fsd-architecture.md) | P1: контракты типов, разворот билдеров, kebab-case, public API, оркестраторы | ✅ |
| 4 | [04-correctness-perf.md](04-correctness-perf.md) | P2: удаление датасета, кэш, иерархия, formula-to-sql, React-фиксы | — |
| 5 | [05-hygiene.md](05-hygiene.md) | P3: логгер, миграции persist, переименования, JSDoc | — |

## Phase 0 — что сделано

| Файл | Изменение |
|------|-----------|
| `vitest.config.ts` | Новый: env `node`, алиасы из tsconfig (`vite-tsconfig-paths`), `passWithNoTests` до появления тестов |
| `package.json` | Скрипты `test`/`test:watch`/`test:coverage`; `lint` → `eslint src` |
| `eslint.config.mjs` | `eslint-plugin-boundaries`: слои FSD (element-types) + public API слайсов (entry-point), severity `warn` |

### Решения и trade-offs

- **Boundaries в `warn`, не `error`**: в коде ~103 нарушения FSD (глубокие импорты,
  features→widgets, widgets→widgets, shared→entities). Включение `error` сразу
  заблокировало бы сборку. Переключение на `error` — критерий выхода Phase 3d.
- **`next lint` не работал**: команда удалена в Next 16, скрипт молча падал —
  линт в проекте не запускался вовсе. После перевода на прямой `eslint src`
  вскрылись 16 ошибок `react-hooks/set-state-in-effect`, `use-memo`,
  `static-components`, `no-empty-object-type` — временно переведены в `warn`
  (блок `preexistingDebt` в конфиге), чинятся в Phase 4, после чего блок удаляется.
- **`NODE_ENV=production` в окружении разработчика**: npm пропускает
  devDependencies (`omit=dev`). Ставить зависимости через
  `npm install --include=dev`.

### Как проверено

`type-check` ✅, `lint` ✅ (0 errors / 119 warnings — все задокументированный долг),
`vitest run` ✅ (passWithNoTests).
