# Гид по правкам: как ориентироваться в проекте

Документ для владельца проекта. Цель — чтобы любую правку можно было
начать с правильного файла, не читая всю кодовую базу.

## Карта слоёв (FSD): где что лежит

Поток зависимостей строго сверху вниз: `app → widgets → features → entities → shared`.

| Хочу поменять… | Иду в… |
|---|---|
| Страницу целиком (композиция блоков) | `src/widgets/<страница>/ui/*Content.tsx` |
| Действие пользователя (добавить KPI, удалить группу…) | `src/features/<действие>/` |
| Хранение данных (что лежит в сторе) | `src/entities/<сущность>/model/store.ts` |
| SQL и вычисления | `src/shared/lib/computation/` |
| Внешний вид базовых элементов (кнопки, селекты, тосты) | `src/shared/ui/` |
| Типы-контракты между слоями | `src/shared/lib/types/`, `src/shared/lib/validators.ts` |

Полная карта слоёв: [architecture/fsd-map.md](architecture/fsd-map.md).

## Как текут данные (главный конвейер)

```
Страница (widgets/…/ui)
  → хук страницы (widgets/…/model/use-*.ts)      ← здесь собираются параметры
    → useComputation (shared/lib/computation/hooks) ← кэш, debounce, отмена
      → engine (duckdb/engine.ts | postgres/engine.ts)
        → compileQuery (query-compiler.ts)        ← ЗДЕСЬ рождается SQL
        → исполнение (worker.ts в браузере | pg-compute.ts на сервере)
        → post-process.ts                          ← формулы mathjs построчно
        → aggregation.ts                           ← строка «Итого»
```

Практические следствия:
- **Неправильное число в таблице** → смотреть query-compiler (SQL),
  потом post-process (формулы), потом aggregation (итоги).
- **Лишние пересчёты / спиннер** → use-computation и хуки страниц
  (что попало в `deps`, что в `configHash`).
- **Не та колонка/группировка** → параметры собирает хук страницы
  (`buildParams`), компилятор только исполняет.

## Типовые задачи — рецепты

**Добавить поле в метрику/группу/дашборд:**
1. Тип: `shared/lib/validators.ts` (Zod-схема) — отсюда выводятся TS-типы.
2. Стор сущности: `entities/<…>/model/store.ts` (+ миграция persist, если
   поле обязательное: `shared/lib/storage/migration.ts`).
3. UI редактирования: соответствующий `features/*-builder`.
4. Если поле едет на сервер (PG) — добавить в
   `shared/api/server-actions/schemas.ts`, иначе Zod его отрежет.

**Добавить новый виджет на страницу:** создать `src/widgets/<имя>/`
(ui + model + index.ts с публичным API), подключить в \*Content.tsx
страницы. Импорты только через `index.ts` — boundaries-линтер следит.

**Поменять формат отображения чисел:** `formatValue` в
`shared/lib/computation/lib/utils.ts` (движок) и `MetricCell` в
`entities/metric/ui/` (ячейки таблиц).

**Добавить тип агрегации (например, STDDEV):** `buildAggregateExpr`
в query-compiler.ts + ветка в aggregation.ts (как переагрегировать
в «Итого») + опция в TemplateForm.

## Перед каждым коммитом (гейт)

```fish
npm run type-check && npm run lint && npm run build && npm test
```

Всё четыре зелёные — можно коммитить. Тесты лежат рядом с кодом
(`*.test.ts`), запускаются Vitest'ом.

## Релиз в main (docs не публикуются)

```fish
git checkout main
git merge develop --no-commit --no-ff
git rm -r -f docs
git commit -m "release: …"
git push origin main
git checkout develop
```

## Что читать, чтобы понять историю решений

- [AUDITE.md](AUDITE.md) — исходный аудит и почему был рефакторинг.
- [refactoring/00-overview.md](refactoring/00-overview.md) — журнал фаз:
  каждое крупное решение с trade-off'ами.
- [AUDIT-CORE-MODULES.md](AUDIT-CORE-MODULES.md) — устройство ядра
  через призму его слабых мест (лучший «учебник» по движку).
- [architecture/date-grouping.md](architecture/date-grouping.md) —
  как устроены группировки по датам и 2-D.
- [ROADMAP.md](ROADMAP.md) — что делать дальше.

## Конвенции (коротко)

- Слайсы — kebab-case; публичный API слайса — только `index.ts`.
- JSDoc на русском у экспортируемых функций.
- toast — только из `@/shared/ui/toast`.
- Ключи localStorage persist-сторов не переименовывать (миграции — да,
  ключи — нет).
- Сторы entities мутируют только себя; каскады — в features-оркестраторах
  (пример: `features/setup-dataset/model/remove-dataset.ts`).
