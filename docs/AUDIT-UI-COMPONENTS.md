# Аудит UI-компонентов: адаптивность, темы, дубли, toast

Дата: 2026-06-11. Объём: все компоненты `src/**/ui`, сканирование по четырём
осям (адаптивность, тёмная/светлая тема, дублирование функционала,
использование toast) + точечная верификация находок.

## 1. Toast — главная системная проблема (исправлено)

Существовала обёртка `shared/ui/toast.ts` (единые длительности: error 5s,
warning 4s, success/info 3s, infinite loading), но пользовались ею только
**3 файла из 24** — остальные импортировали `sonner` напрямую, получая
дефолтные длительности и разнобой поведения.

**Исправлено:**
- все 21 файл переведены на `@/shared/ui/toast` (прямой импорт sonner
  остался только у `<Toaster />` в layout — это легально);
- сигнатура `toast.loading(message, { id })` приведена к sonner-форме
  (раньше второй аргумент был голой строкой id — единственный вызов
  `use-file-import.ts` обновлён);
- из обёртки удалён мёртвый код (`description: undefined : undefined`);
- `toast.dismiss` принимает `string | number | undefined` как в sonner.

Конвенция: **новый код импортирует toast только из `@/shared/ui/toast`**.

## 2. Тёмная/светлая тема

Систематический скан `bg-white`, `text-slate-9xx`, `hover:bg-<светлое>` без
парного `dark:` показал, что покрытие почти полное. Найдено и исправлено:

- `dashboard-builder/ui/MappingRow.tsx` — sticky-ячейка имени группы:
  `group-hover:bg-slate-50` без dark-варианта → при hover в тёмной теме
  ячейка вспыхивала светлым. Добавлен `dark:group-hover:bg-slate-900/50`.
- `features/metric-template/ui/TemplateForm.tsx` — сырой `<select>`
  с ручными стилями заменён на `shared/ui/Select` (тёмная тема — из
  одной точки).
- `features/add-kpi-widget/ui.tsx` — сырые `<select>`/`<input>` с ручными
  стилями (включая комментарии «ФИКС ПРОЗРАЧНОСТИ») заменены на shared/ui.

`Toaster` уже настроен на `theme="system"` ✅.

## 3. Адаптивность

Хорошее: основные сетки responsive (`KPIGrid`: `grid-cols-2 md:4 lg:5`;
страницы: `grid-cols-1 md:2 lg:12`); таблицы обёрнуты в `overflow-x-auto`;
диалоги на `sm:max-w-*`.

Исправлено:
- `TemplateForm` — `grid-cols-2` → `grid-cols-1 sm:grid-cols-2`;
- `postgres-connection-form` — то же + `col-span-2` → `sm:col-span-2`.

Осталось (некритично, фоном):
- фиксированные ширины поповеров `w-[350px]` (configure-group-metric,
  configure-table-metric) — на экранах <375px упрутся в край;
- `GroupAdder` `w-50` — длинные имена групп обрезаются;
- инпут названия метрики в `MetricRow` ограничен `max-w-[200px]`.

## 4. Дублирование функционала

Исправлено в этой итерации:
- **Извлечение переменных формулы**: add-kpi-widget использовал самодельный
  regex (принимал имена функций за переменные) — переведён на общий
  `extractVariables` (mathjs AST), как в group-builder.
- **Выбор колонок**: KPI-диалог не фильтровал numeric-колонки — выровнен
  с MetricRow (`classification === 'numeric'`).
- **Select/Input**: два места с сырыми select заменены на shared/ui.
- **Drag-and-drop сенсоры**: фикс Space/click-в-инпуте сделан один раз
  в `shared/ui/drag-drop-list` (Smart*Sensor), а не точечными
  `stopPropagation` по потребителям.

Зафиксировано, не исправлялось (кандидаты на вынос при следующем касании):
- локальное форматирование чисел `toLocaleString('ru-RU')` повторяется
  в ~10 файлах (charts, KPI-карточки, таблицы) при существующем
  `formatValue` в computation/lib/utils — стоит вынести лёгкий
  `formatNumber` в shared/lib и переиспользовать;
- `buildVirtualMetrics` дублируется внутри pg-engine и worker (по строке
  breakdown и сводке) — кандидат на общий хелпер рядом с post-process;
- KPI-карточка и GroupKpiCard стилистически близки, но живут раздельно.

## 5. Попутно исправленные баги (запрос пользователя)

| Баг | Причина | Фикс |
|-----|---------|------|
| Пробел не вводится в название/ед.изм. метрики | KeyboardSensor dnd-kit перехватывал Space из вложенных инпутов (preventDefault) | SmartKeyboardSensor/SmartPointerSensor в drag-drop-list игнорируют события из input/textarea/select/button/a/[data-no-dnd] |
| Заданные units метрик группы нигде не отображаются | `buildVirtualMetric` брал unit только из template.suffix/prefix, игнорируя `metric.unit` | приоритет `metric.unit` |
| В дашборде unit отображается, но задать негде | у колонок дашборда (virtualMetrics) не было UI | инпут «ед.» в строке колонки билдера + `updateVirtualMetricUnit` |
| В дашборд можно добавить группу чужого датасета | `availableGroups` не фильтровался | фильтр по `datasetId` дашборда (legacy-группы без datasetId не скрываются); полный список отдаётся только MappingRow |
| Логика добавления KPI отличается от основной | regex-переменные, нефильтрованные колонки, сырые select | выровнено с group-builder |
